/**
 * Global open/closed state for the command palette, shared across every
 * call site via useState (same pattern VaultTree.vue uses for its context
 * menu) - a plain ref here would give each caller its own disconnected copy.
 */
export function useCommandPalette() {
  const isOpen = useState<boolean>('commandPaletteOpen', () => false)

  function open(): void {
    isOpen.value = true
  }

  function close(): void {
    isOpen.value = false
  }

  function toggle(): void {
    isOpen.value = !isOpen.value
  }

  return { isOpen, open, close, toggle }
}
