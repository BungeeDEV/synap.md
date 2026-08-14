import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useMobileNavStore = defineStore('mobileNav', () => {
  const isDrawerOpen = ref(false)

  function open(): void {
    isDrawerOpen.value = true
  }

  function close(): void {
    isDrawerOpen.value = false
  }

  function toggle(): void {
    isDrawerOpen.value = !isDrawerOpen.value
  }

  return { isDrawerOpen, open, close, toggle }
})
