/**
 * Split-view has no room below md (see ViewModeToggle, which already hides
 * the option there) - this downgrades any tab still sitting in 'split' the
 * moment the viewport crosses the breakpoint, including tabs that aren't
 * the currently mounted NoteEditor instance. Call once (app.vue), not per
 * NoteEditor - the store holds viewMode for every open tab, not just the
 * active one.
 */
export function useMobileSplitViewGuard(): void {
  const { isMobile } = useIsMobile()
  const tabs = useTabsStore()

  watch(isMobile, (mobile) => {
    if (!mobile) return
    for (const tab of tabs.tabs) {
      if (tab.viewMode === 'split') tabs.setViewMode(tab.path, 'reader')
    }
  }, { immediate: true })
}
