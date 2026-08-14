import { basename, extname } from 'node:path'

export const ATTACHMENTS_DIR = '_attachments'

interface AttachmentType {
  ext: string
  mime: string
  kind: 'image' | 'document'
}

export const ALLOWED_ATTACHMENT_TYPES: AttachmentType[] = [
  { ext: 'png', mime: 'image/png', kind: 'image' },
  { ext: 'jpg', mime: 'image/jpeg', kind: 'image' },
  { ext: 'jpeg', mime: 'image/jpeg', kind: 'image' },
  { ext: 'gif', mime: 'image/gif', kind: 'image' },
  { ext: 'webp', mime: 'image/webp', kind: 'image' },
  { ext: 'svg', mime: 'image/svg+xml', kind: 'image' },
  { ext: 'pdf', mime: 'application/pdf', kind: 'document' }
]

function normalizeExt(ext: string): string {
  return ext.toLowerCase().replace(/^\./, '')
}

/** Checks the extension AND the declared content-type against the allow-list - a client can lie about either one alone. */
export function isAllowedAttachment(ext: string, mimeType: string): boolean {
  return ALLOWED_ATTACHMENT_TYPES.some((type) => type.ext === normalizeExt(ext) && type.mime === mimeType)
}

export function mimeTypeForExtension(ext: string): string | null {
  return ALLOWED_ATTACHMENT_TYPES.find((type) => type.ext === normalizeExt(ext))?.mime ?? null
}

/** Collision-safe, sanitized filename: a timestamp prefix plus a cleaned original name (alphanumeric/hyphen/dot only). */
export function sanitizeAttachmentFilename(originalName: string): string {
  const ext = extname(originalName).replace(/[^a-zA-Z0-9.]/g, '').toLowerCase()
  const base = basename(originalName, extname(originalName))
  const cleanedBase = base.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'file'
  return `${Date.now()}-${cleanedBase}${ext}`
}

export function maxAttachmentSizeBytes(maxAttachmentSizeMb: string): number {
  const mb = Number.parseInt(maxAttachmentSizeMb, 10)
  return (Number.isFinite(mb) && mb > 0 ? mb : 10) * 1024 * 1024
}
