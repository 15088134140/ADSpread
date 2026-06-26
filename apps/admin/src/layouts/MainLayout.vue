<template>
  <el-container class="main-layout">
    <el-aside :width="isCollapse ? '64px' : '200px'" class="sidebar">
      <div class="logo">
        <h1 v-if="!isCollapse">ADSpread</h1>
        <span v-else>AD</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
      >
        <side-menu-item
          v-for="node in permissionStore.menuTree"
          :key="node.id"
          :node="node"
          i18n-prefix="menu"
        />
      </el-menu>
    </el-aside>

    <el-container class="main-container">
      <el-header class="header">
        <div class="header-left">
          <el-button
            :icon="isCollapse ? Expand : Fold"
            @click="toggleSidebar"
            circle
            size="small"
          />
        </div>
        <div class="header-right">
          <el-select
            :model-value="appStore.locale"
            size="small"
            class="locale-switch"
            @change="handleLocaleChange"
          >
            <el-option label="日本語" value="ja" />
            <el-option label="简体中文" value="zh-CN" />
            <el-option label="English" value="en" />
          </el-select>
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-avatar :size="32" :src="userStore.userInfo.avatar">
                {{ userStore.userInfo.name?.charAt(0) || 'A' }}
              </el-avatar>
              <span class="username">{{ userStore.userInfo.name || 'Admin' }}</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>
                  {{ t('common.profile') }}
                </el-dropdown-item>
                <el-dropdown-item command="settings">
                  <el-icon><Setting /></el-icon>
                  {{ t('common.settings') }}
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  {{ t('common.logout') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade-transform" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  Fold,
  Expand,
  User,
  Setting,
  SwitchButton,
} from '@element-plus/icons-vue';
import { ElMessageBox } from 'element-plus';
import { useUserStore } from '@/stores/user';
import { useAppStore } from '@/stores/app';
import { usePermissionStore } from '@/stores/permission';
import type { AppLocale } from '@/locales';
import SideMenuItem from './SideMenuItem.vue';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const userStore = useUserStore();
const appStore = useAppStore();
const permissionStore = usePermissionStore();

const isCollapse = ref(false);
const activeMenu = computed(() => route.path);

const toggleSidebar = () => {
  isCollapse.value = !isCollapse.value;
};

function handleLocaleChange(value: AppLocale) {
  appStore.setLocale(value);
}

const handleCommand = async (command: string) => {
  if (command === 'logout') {
    try {
      await ElMessageBox.confirm(
        t('common.messages.confirmLogout'),
        t('common.tip'),
        {
          confirmButtonText: t('common.confirmButtonText'),
          cancelButtonText: t('common.cancelButtonText'),
          type: 'warning',
        },
      );
      userStore.logout();
      router.push('/login');
    } catch {
      // User cancelled
    }
  }
};
</script>

<style scoped lang="scss">
.main-layout {
  height: 100vh;
  width: 100%;

  .sidebar {
    background-color: #304156;
    transition: width 0.3s;

    .logo {
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #2b2f3a;
      color: #fff;
      font-size: 18px;
      font-weight: bold;
      overflow: hidden;

      h1 {
        font-size: 20px;
        margin: 0;
        color: #fff;
      }
    }
  }

  .main-container {
    display: flex;
    flex-direction: column;
    background-color: #f0f2f5;

    .header {
      background-color: #fff;
      box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 20px;
      height: 60px;

      .header-right {
        display: flex;
        align-items: center;
        gap: 16px;

        .locale-switch {
          width: 120px;
        }

        .user-info {
          display: flex;
          align-items: center;
          cursor: pointer;

          .username {
            margin-left: 8px;
            font-size: 14px;
          }
        }
      }
    }

    .main-content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }
  }
}

.fade-transform-leave-active,
.fade-transform-enter-active {
  transition: all 0.3s;
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
