import { createI18n } from 'vue-i18n'
import zh from './locales/zh'
import en from './locales/en'

const LOCALE_KEY = 'texture-atlas-locale'

function initialLocale(): 'zh' | 'en' {
  try {
    const s = localStorage.getItem(LOCALE_KEY)
    if (s === 'en' || s === 'zh') return s
  } catch {
    /* ignore */
  }
  return 'zh'
}

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: 'zh',
  messages: {
    zh,
    en,
  },
})

export function persistLocale(locale: string) {
  try {
    localStorage.setItem(LOCALE_KEY, locale)
  } catch {
    /* ignore */
  }
}
