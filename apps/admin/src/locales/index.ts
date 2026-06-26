import { createI18n } from 'vue-i18n';
import ja from './ja';
import zhCN from './zh-CN';
import en from './en';

export type AppLocale = 'ja' | 'zh-CN' | 'en';

export const LOCALE_STORAGE_KEY = 'locale';

export const SUPPORTED_LOCALES: AppLocale[] = ['ja', 'zh-CN', 'en'];

function getInitialLocale(): AppLocale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'ja' || stored === 'zh-CN' || stored === 'en') {
    return stored;
  }
  return 'ja';
}

const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'ja',
  messages: {
    ja,
    'zh-CN': zhCN,
    en,
  },
});

export default i18n;
