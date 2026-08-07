export type SidebarPanel = 'explorer' | 'outline'

export const useSidebarPanelStore = defineStore('sidebarPanel', () => {
  const activePanel = ref<SidebarPanel>('explorer')
  // Desktop-only "Zen mode" - whether the whole sidebar is hidden, toggled
  // via Cmd/Ctrl+\ (useGlobalHotkeys.ts). Independent of mobileNav's drawer
  // open/closed state, which is a different (mobile-only, overlay-based)
  // concept - VaultSidebar.vue applies this one only at the `md:` breakpoint
  // and up, so it never interacts with the mobile drawer's own visibility.
  const collapsed = ref(false)

  function setPanel(panel: SidebarPanel): void {
    activePanel.value = panel
  }

  function toggleCollapsed(): void {
    collapsed.value = !collapsed.value
  }

  return { activePanel, setPanel, collapsed, toggleCollapsed }
})
