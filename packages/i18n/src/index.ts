import { createI18n } from 'vue-i18n'
import de from './locales/de'
import en from './locales/en'

export const LOCALE_IDS = ['de', 'en'] as const
export type LocaleId = typeof LOCALE_IDS[number]

export function createSynapI18n() {
  return createI18n({
    legacy: false,
    locale: 'de', // Default locale
    fallbackLocale: 'de',
    messages: {
      de,
      en
    }
  })
}
