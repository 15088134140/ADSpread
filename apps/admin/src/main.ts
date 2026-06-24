import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import en from 'element-plus/es/locale/lang/en';
import ja from 'element-plus/es/locale/lang/ja';
import { createI18n } from 'vue-i18n';

import App from './App.vue';
import router from './router';
import { useUserStore } from './stores/user';

import './assets/styles/main.scss';

const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('locale') || 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': {},
    'en': {},
    'ja': {},
  },
});

const app = createApp(App);

// Register all icons
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

const localeMap: Record<string, any> = {
  'zh-CN': zhCn,
  'en': en,
  'ja': ja,
};

app.use(createPinia());
app.use(router);
app.use(ElementPlus, {
  locale: localeMap[i18n.global.locale.value] || zhCn,
});
app.use(i18n);

// Initialize user store
const userStore = useUserStore();
userStore.initFromStorage();

app.mount('#app');
