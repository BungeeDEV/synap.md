export default defineNuxtPlugin(() => {
  const es = new EventSource('/api/vault/events')

  es.addEventListener('file_updated', (event) => {
    try {
      const payload = JSON.parse(event.data)
      const path = payload.path
      
      if (typeof path === 'string') {
        const tabsStore = useTabsStore()
        
        // Only trigger the API reload if the file is currently open in any tab.
        // The tabsStore.reconcileExternalContent automatically fetches the newest
        // version and injects it into the editor without losing local state.
        if (tabsStore.tabs.some(t => t.path === path)) {
          console.log(`[SSE] file_updated received for open tab: ${path}, reconciling...`)
          void tabsStore.reconcileExternalContent([path])
        }
      }
    } catch (err) {
      console.error('[SSE] Failed to parse file_updated payload:', err)
    }
  })
})
