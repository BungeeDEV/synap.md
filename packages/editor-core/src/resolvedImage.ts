import { mergeAttributes } from '@tiptap/core'
import Image from '@tiptap/extension-image'

/** `_attachments/...` (relative, vault-local) needs the download route; anything else (external URL, blob: object URL) is used as-is. Mirrors the old CodeMirror Magic View's `resolveImageSrc()`. */
function resolveImageSrc(rawSrc: string): string {
  if (!rawSrc.startsWith('_attachments/')) return rawSrc
  return `/api/vault/attachment?path=${encodeURIComponent(rawSrc)}`
}

/**
 * `node.attrs.src` stays the literal vault-relative path (what
 * tiptap-markdown's default image serializer writes back into the .md
 * file's `![alt](src)`) - only the live editor DOM's `src` is swapped to the
 * resolved download URL, via this `renderHTML` override.
 */
export const ResolvedImage = Image.extend({
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes, {
      src: resolveImageSrc(HTMLAttributes.src as string),
      class: 'my-1 inline-block max-h-80 max-w-full rounded-md align-middle'
    })]
  }
})
