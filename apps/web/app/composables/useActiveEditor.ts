import { shallowRef } from 'vue'
import type { Editor } from '@tiptap/core'

// Module-scoped shallowRef instead of the useState pattern used elsewhere
// (contextMenu, commandPaletteOpen): useState stores values on a reactive()
// payload object, which would deep-proxy the Editor instance - Tiptap/
// ProseMirror instances aren't meant to be reactively wrapped (same
// reasoning the old CodeMirror-era useActiveEditorView documented). Only
// ever written from NoteEditor's mount/unmount and read from sidebar
// components (OutlinePanel's jump-to-heading) that live outside NoteEditor's
// own subtree, both client-only, so there's no SSR payload to keep in sync.
const activeEditor = shallowRef<Editor | null>(null)

export function useActiveEditor() {
  function setEditor(editor: Editor | null): void {
    activeEditor.value = editor
  }

  return { editor: activeEditor, setEditor }
}
