import { createSynapI18n } from '@synap/i18n'
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  const i18n = createSynapI18n()
  nuxtApp.vueApp.use(i18n)

  // Exposes the global composer (i18n.global) on nuxtApp so non-component
  // code (raw plugins like fetch-error-toast.client.ts, composables outside
  // setup) can translate without vue-i18n's useI18n(), which requires a
  // live component instance via Vue's inject() and isn't available there.
  return { provide: { i18n: i18n.global } }
})
