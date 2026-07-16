import { shallowRef } from 'vue'
import type { EditorView } from '@codemirror/view'

// Deliberately a module-scoped shallowRef instead of the useState pattern used
// elsewhere (contextMenu, commandPaletteOpen): useState stores values on a
// reactive() payload object, which would deep-proxy the EditorView instance -
// CodeMirror instances aren't meant to be reactively wrapped. It's only ever
// written from NoteEditor's onMounted/onBeforeUnmount and read from click
// handlers, both client-only, so there's no SSR payload to keep in sync.
const activeView = shallowRef<EditorView | null>(null)

export function useActiveEditorView() {
  function setView(view: EditorView | null): void {
    activeView.value = view
  }

  return { view: activeView, setView }
}
