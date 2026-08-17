import { createSynapI18n } from '@synap/i18n'
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  const i18n = createSynapI18n()
  nuxtApp.vueApp.use(i18n)

  // Initialize locale from preferences if store is available (or we can watch it)
  // We'll watch it in app.vue or a dedicated auth/preference plugin, 
  // but for now we mount it so it's available.
})
