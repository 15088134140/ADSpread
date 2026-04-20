const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://admin-test.admercury.net/#/store/index';
const USERNAME = 'admin';
const PASSWORD = '123456';
const SCREENSHOT_DIR = __dirname;

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
}

async function main() {
  await ensureDirectoryExists(SCREENSHOT_DIR);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  // Set longer timeout
  page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);

  try {
    console.log('Navigating to URL...');
    await page.goto(BASE_URL, {
      waitUntil: 'networkidle',
      timeout: 120000
    });

    // Wait a long time for the React/Vue app to bootstrap
    console.log('Waiting for application to load (15 seconds)...');
    await delay(15000);

    // Check page is still loading?
    const hasLoadingSpinner = await page.$('.first-loading-wrap');
    if (hasLoadingSpinner) {
      console.log('Still loading, waiting another 10 seconds...');
      await delay(10000);
    }

    // Wait for any element to appear
    console.log('Waiting for any UI element to render...');
    let foundUI = false;
    for (let i = 0; i < 15; i++) {
      const anyElement = await page.$('nav, aside, .sidebar, .menu, button, input');
      if (anyElement && await anyElement.isVisible()) {
        foundUI = true;
        break;
      }
      await delay(2000);
    }

    if (!foundUI) {
      console.log('No UI found after waiting, taking debug screenshot...');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug_no_ui.png'), fullPage: true });
      const html = await page.content();
      fs.writeFileSync(path.join(SCREENSHOT_DIR, 'debug_final.html'), html);
      throw new Error('Application did not render UI after long wait');
    }

    console.log('UI rendered, looking for login form...');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug_after_render.png'), fullPage: true });

    // Find login inputs
    let usernameInput = null;
    let passwordInput = null;

    for (const selector of [
      'input[placeholder*="用户名"]',
      'input[placeholder*="账号"]',
      'input[name="username"]',
      'input[id="username"]',
      'input[type="text"]'
    ]) {
      try {
        const el = await page.$(selector);
        if (el && await el.isVisible()) {
          usernameInput = el;
          break;
        }
      } catch {}
    }

    for (const selector of [
      'input[placeholder*="密码"]',
      'input[name="password"]',
      'input[id="password"]',
      'input[type="password"]'
    ]) {
      try {
        const el = await page.$(selector);
        if (el && await el.isVisible()) {
          passwordInput = el;
          break;
        }
      } catch {}
    }

    // If still not found, get all visible inputs
    if (!usernameInput || !passwordInput) {
      const inputs = await page.$$('input');
      const visibleInputs = [];
      for (const input of inputs) {
        try {
          if (await input.isVisible()) {
            visibleInputs.push(input);
          }
        } catch {}
      }
      console.log(`Found ${visibleInputs.length} visible inputs`);
      if (visibleInputs.length >= 2) {
        usernameInput = visibleInputs[0];
        passwordInput = visibleInputs[1];
      }
    }

    if (usernameInput && passwordInput) {
      console.log('Filling credentials...');
      await usernameInput.fill(USERNAME);
      await passwordInput.fill(PASSWORD);

      // Find login button
      let loginButton = null;
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        if (await btn.isVisible()) {
          const text = (await page.evaluate(el => el.textContent.toLowerCase(), btn));
          if (text.includes('登录') || text.includes('login') || text.includes('提交') || text === '') {
            loginButton = btn;
            break;
          }
        }
      }

      if (loginButton) {
        console.log('Clicking login button...');
        await loginButton.click();
        await delay(8000); // Wait for login redirect
      }
    } else {
      console.log('No login form found, trying to proceed...');
    }

    await delay(10000); // Wait after login
    console.log('After login, waiting for menu...');

    // Wait for menu items
    const menuItems = await page.evaluate(() => {
      const items = [];

      // Try different approaches - just get all visible text elements on the left
      document.querySelectorAll('*').forEach(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        let text = el.textContent.trim();

        // Filter
        if (!text || text.length === 0 || text.length > 30) return;
        if (style.display === 'none' || style.visibility === 'hidden') return;
        if (rect.width < 20 || rect.height < 20) return;
        if (rect.top < 40) return; // Skip header
        if (rect.left > 400) return; // Only left side

        // Check that element actually has size
        if (rect.width === 0 || rect.height === 0) return;

        // Check if child doesn't have the same text
        let childSameText = false;
        Array.from(el.childNodes).forEach(child => {
          if (child.nodeType === 1 && child.textContent.trim() === text) {
            childSameText = true;
          }
        });
        if (childSameText) return;

        items.push({
          text: text,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          left: rect.left,
          width: rect.width,
          height: rect.height
        });
      });

      // Sort by y position and deduplicate
      items.sort((a, b) => a.y - b.y);
      const unique = [];
      const seen = new Set();
      items.forEach(item => {
        if (!seen.has(item.text)) {
          seen.add(item.text);
          unique.push(item);
        }
      });

      return unique;
    });

    console.log(`Found ${menuItems.length} menu items:`);
    menuItems.forEach((m, i) => console.log(`  ${i+1}. ${m.text}`));

    if (menuItems.length === 0) {
      const html = await page.content();
      fs.writeFileSync(path.join(SCREENSHOT_DIR, 'debug_no_menu.html'), html);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'debug_no_menu.png'), fullPage: true });
    }

    // Process each menu
    for (let i = 0; i < menuItems.length; i++) {
      const menu = menuItems[i];
      const menuName = sanitizeFilename(menu.text);
      console.log(`\n[${i+1}/${menuItems.length}] Processing: ${menuName}`);

      try {
        // Click menu
        await page.mouse.click(menu.x, menu.y);
        await delay(4000); // Wait for page to load

        // Screenshot the page
        const pageFilename = `${menuName}_页面.png`;
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, pageFilename),
          fullPage: true
        });
        console.log(`  ✓ Saved: ${pageFilename}`);

        // Find all buttons in content area
        const buttons = await page.evaluate((minLeft) => {
          const results = [];
          const buttons = document.querySelectorAll('button, [role="button"], .n-button');

          buttons.forEach(btn => {
            const rect = btn.getBoundingClientRect();
            const style = window.getComputedStyle(btn);
            let text = btn.textContent.trim();

            if (style.display === 'none' || style.visibility === 'hidden') return;
            if (rect.width < 30 || rect.height < 20) return;
            if (rect.left < minLeft + 20) return; // Not in menu area

            // Deduplicate by text
            if (results.some(r => r.text === text)) return;

            // Get center
            results.push({
              text: text || '按钮',
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2
            });
          });

          return results.slice(0, 10);
        }, menu.left + menu.width);

        console.log(`  Found ${buttons.length} buttons`);

        for (let j = 0; j < buttons.length; j++) {
          const btn = buttons[j];
          const btnText = sanitizeFilename(btn.text);

          try {
            // Count modals before click
            const dialogCountBefore = await page.evaluate(() => {
              return document.querySelectorAll('.n-modal, .el-dialog, .modal, .dialog, .popover, .popup').length;
            });

            await page.mouse.click(btn.x, btn.y);
            await delay(2500);

            // Check if modal opened
            const dialogCountAfter = await page.evaluate(() => {
              return document.querySelectorAll('.n-modal, .el-dialog, .modal, .dialog, .popover, .popup').length;
            });

            if (dialogCountAfter > dialogCountBefore) {
              const filename = `${menuName}_${btnText}.png`;
              await page.screenshot({
                path: path.join(SCREENSHOT_DIR, filename),
                fullPage: true
              });
              console.log(`  ✓ Saved popup: ${filename}`);

              // Try to close
              await page.evaluate(() => {
                const close = document.querySelectorAll(
                  '.n-modal__close, .el-dialog__close, .ant-modal-close, .close-btn, [aria-label="关闭"], .v-popover__close'
                );
                if (close.length) close[close.length - 1].click();
              });
              await delay(1000);
            }
          } catch (err) {
            console.log(`  ✗ Failed button ${btnText}: ${err.message.slice(0, 60)}`);
          }
        }

      } catch (err) {
        console.log(`  ✗ Failed menu ${menuName}: ${err.message.slice(0, 60)}`);
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ Screenshot task completed!');
    console.log(`📂 Directory: ${SCREENSHOT_DIR}`);

    const allPngFiles = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
    const targetFiles = allPngFiles.filter(f => !f.startsWith('debug_') && f !== 'error_screenshot.png');

    console.log(`📊 Total screenshots taken: ${targetFiles.length}`);
    console.log('Files:');
    targetFiles.forEach(f => console.log(`   - ${f}`));
    console.log('='.repeat(60));

  } catch (err) {
    console.error('\n❌ Error:', err);
    try {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error_final.png'), fullPage: true });
    } catch {}
    throw err;
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
