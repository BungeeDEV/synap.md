export type AttachmentInsertKind = 'image' | 'file'

/**
 * Bridges slash commands (which only ever get the Tiptap editor instance, no
 * access to NoteEditor.vue's local upload machinery) to NoteEditor.vue's
 * existing insertAttachment() - since only one editor instance/tab is ever
 * mounted at a time. NoteEditor.vue watches this and opens a file picker;
 * picking a file (or cancelling) clears it again.
 */
export function useAttachmentInsertRequest() {
  return useState<AttachmentInsertKind | null>('attachmentInsertRequest', () => null)
}

export function requestAttachmentInsert(kind: AttachmentInsertKind): void {
  useAttachmentInsertRequest().value = kind
}
