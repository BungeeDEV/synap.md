export type SidebarPanel = 'explorer' | 'outline'

export const useSidebarPanelStore = defineStore('sidebarPanel', () => {
  const activePanel = ref<SidebarPanel>('explorer')

  function setPanel(panel: SidebarPanel): void {
    activePanel.value = panel
  }

  return { activePanel, setPanel }
})
