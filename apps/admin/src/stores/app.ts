import { defineStore } from 'pinia';
import { ref } from 'vue';
import i18n, { type AppLocale, LOCALE_STORAGE_KEY } from '@/locales';

function getInitialLocale(): AppLocale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'ja' || stored === 'zh-CN' || stored === 'en') {
    return stored;
  }
  return 'ja';
}

export const useAppStore = defineStore('app', () => {
  const locale = ref<AppLocale>(getInitialLocale());

  function setLocale(l: AppLocale) {
    locale.value = l;
    localStorage.setItem(LOCALE_STORAGE_KEY, l);
    i18n.global.locale.value = l;
  }

  return {
    locale,
    setLocale,
  };
});
