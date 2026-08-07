/**
 * App-wide keyboard shortcuts - active no matter what's focused (unlike
 * Tiptap's own `addKeyboardShortcuts()` in NoteEditor.vue, which only fires
 * while the ProseMirror content itself has focus). Registered once from
 * app.vue, so it's live on every route, not just the editor page.
 *
 * `@vueuse/core`'s `useMagicKeys` isn't a dependency of this project (see
 * package.json) and wasn't worth adding for a single listener this size -
 * a plain `window.addEventListener('keydown', ...)` covers everything
 * needed here without pulling in a library for it.
 */

/** macOS uses Cmd for shortcuts that are Ctrl everywhere else - never check both, always the one that matches the current platform. */
function isMac(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)
}

export function useGlobalHotkeys(): void {
  const { loggedIn } = useUserSession()
  const { toggle: toggleCommandPalette, open: openCommandPalette } = useCommandPalette()
  const { triggerNewNote } = useNoteCreation()
  const sidebarPanel = useSidebarPanelStore()

  function handleKeydown(event: KeyboardEvent): void {
    // /login and /setup have no vault/command-palette to act on - don't
    // hijack Ctrl+F/Ctrl+K there (e.g. someone genuinely wanting the
    // browser's own find-in-page on a login page).
    if (!loggedIn.value) return

    const mod = isMac() ? event.metaKey : event.ctrlKey
    if (!mod) return

    const key = event.key.toLowerCase()

    // Cmd/Ctrl+Alt+N - "Neue Notiz". Deliberately NOT bare Cmd/Ctrl+N: on
    // every major browser that combo opens a new window and is one of the
    // handful of shortcuts the browser reserves for itself - a page's
    // preventDefault() can't actually stop it. The extra Alt/Option makes
    // it a combination the browser never claims.
    if (event.altKey && key === 'n') {
      event.preventDefault()
      void triggerNewNote()
      return
    }

    // Cmd/Ctrl+F opens the app's own search (the command palette) instead
    // of the browser's native find-in-page bar. Cmd/Ctrl+Shift+F still maps
    // here too (`key` alone doesn't check shiftKey) - that combo already
    // shipped and is documented in Settings > Shortcuts, no reason to break
    // existing muscle memory while adding the plain Ctrl+F case.
    if (!event.altKey && key === 'f') {
      event.preventDefault()
      openCommandPalette()
      return
    }

    // Cmd/Ctrl+K - existing command-palette toggle, unchanged.
    if (!event.altKey && key === 'k') {
      event.preventDefault()
      toggleCommandPalette()
      return
    }

    // Cmd/Ctrl+\ - toggle the sidebar (desktop "Zen mode").
    if (!event.altKey && event.key === '\\') {
      event.preventDefault()
      sidebarPanel.toggleCollapsed()
      return
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
}
