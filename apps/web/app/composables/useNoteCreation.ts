import type { TreeEditState } from '~/components/VaultTree.vue'

/**
 * Extracted out of index.vue so both the "Neue Notiz erstellen" empty-state
 * CTA and the global Cmd/Ctrl+Alt+N hotkey (useGlobalHotkeys.ts) share one
 * code path - previously this only lived inside index.vue's own <script
 * setup>, which worked by accident because the old hotkey listener was also
 * only ever registered there. Now that hotkeys are global (registered once
 * from app.vue, active on every route), creation needs to work from any
 * page - hence the `navigateTo('/')` guard below.
 */
export function useNoteCreation() {
  const sidebarPanel = useSidebarPanelStore()
  const vaultTree = useVaultTreeStore()
  const route = useRoute()

  /** Mirrors VaultTree.vue's own "+ Neue Note" toolbar action (same shared `vaultTreeEditState` used for its inline create/rename input) so every note-creation entry point shares one code path. */
  async function triggerNewNote(): Promise<void> {
    if (route.path !== '/') await navigateTo('/')

    sidebarPanel.setPanel('explorer')
    if (vaultTree.selectedFolder) vaultTree.expand(vaultTree.selectedFolder)
    useState<TreeEditState | null>('vaultTreeEditState', () => null).value = {
      kind: 'create-file',
      parentPath: vaultTree.selectedFolder,
      value: 'Untitled',
      error: null
    }
  }

  return { triggerNewNote }
}
