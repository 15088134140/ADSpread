import type { Directive } from 'vue';
import { usePermissionStore } from '@/stores/permission';

/**
 * v-permission 指令：无指定权限码时移除元素。
 * 用法：<el-button v-permission="'admin:create'">新增</el-button>
 */
export const permission: Directive<HTMLElement, string> = {
  mounted(el, binding) {
    const code = binding.value;
    if (!code) return;
    const permissionStore = usePermissionStore();
    if (!permissionStore.hasPermission(code)) {
      el.parentNode?.removeChild(el);
    }
  },
};
