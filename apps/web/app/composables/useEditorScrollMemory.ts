// Module-level (not inside the composable function) so the Map survives
// across NoteEditor mount/unmount cycles - it lives for the lifetime of the
// page, not of any one component instance. NoteEditor.vue remounts on every
// tab switch (see index.vue's :key), which otherwise loses scroll position
// and makes switching between two open tabs feel like a fresh page load.
const positions = new Map<string, number>()

export function useEditorScrollMemory() {
  function get(path: string): number {
    return positions.get(path) ?? 0
  }

  function set(path: string, value: number): void {
    positions.set(path, value)
  }

  return { get, set }
}
