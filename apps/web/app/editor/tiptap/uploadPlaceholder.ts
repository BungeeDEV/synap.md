import type { Editor } from '@tiptap/core'
import { Node } from '@tiptap/core'
import type { MarkdownNodeSpec } from 'tiptap-markdown'

/**
 * Transient inline atom shown at the cursor while an attachment upload is
 * in flight (paste/drop/slash-command), found again by `id` once the upload
 * settles - ProseMirror-idiomatic replacement for the old CodeMirror
 * `pendingUploads` from/to marker list, which needed manual position-
 * mapping through every subsequent edit. Never present in a saved note
 * under normal operation (always resolved into an image or link before the
 * user can navigate away mid-upload); the empty markdown serializer below
 * is just a safety net against embedding stray HTML if a save race ever
 * catches one anyway.
 */
export const UploadPlaceholder = Node.create({
  name: 'uploadPlaceholder',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      id: { default: '' },
      label: { default: 'Wird hochgeladen…' }
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-upload-placeholder]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return ['span', {
      ...HTMLAttributes,
      'data-upload-placeholder': node.attrs.id,
      class: 'inline-flex items-center gap-1.5 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-sm text-content-tertiary animate-pulse'
    }, node.attrs.label as string]
  },

  addStorage() {
    return {
      markdown: {
        serialize(state) {
          state.write('')
        }
      } satisfies MarkdownNodeSpec
    }
  }
})

let nextId = 0

/** Inserts a placeholder at the current cursor position and returns its id for later lookup via `replaceUploadPlaceholder`. */
export function insertUploadPlaceholder(editor: Editor, label: string): string {
  const id = `upload-${Date.now()}-${nextId++}`
  editor.chain().focus().insertContent({ type: 'uploadPlaceholder', attrs: { id, label } }).run()
  return id
}

/** Finds the placeholder by `id` and replaces it with `content` (an image node for image uploads, a link-marked text run for file attachments), or removes it entirely on upload failure (`content: null`). No-ops if the placeholder was already replaced or its containing edit undone. */
export function replaceUploadPlaceholder(editor: Editor, id: string, content: Record<string, unknown> | null): void {
  let target: { pos: number, size: number } | null = null

  editor.state.doc.descendants((node, pos) => {
    if (target || node.type.name !== 'uploadPlaceholder' || node.attrs.id !== id) return
    target = { pos, size: node.nodeSize }
  })

  if (!target) return

  const { pos, size } = target as { pos: number, size: number }
  const tr = editor.state.tr
  if (content) {
    tr.replaceWith(pos, pos + size, editor.schema.nodeFromJSON(content))
  } else {
    tr.delete(pos, pos + size)
  }
  editor.view.dispatch(tr)
}
