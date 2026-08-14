import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, extname } from 'node:path'

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  const filePart = form?.find((part) => part.name === 'file')

  if (!filePart || !filePart.filename) {
    throw createError({ statusCode: 400, statusMessage: '"file" is required' })
  }

  const config = useRuntimeConfig(event)

  const maxSize = maxAttachmentSizeBytes(config.maxAttachmentSizeMb)
  if (filePart.data.length > maxSize) {
    throw createError({ statusCode: 413, statusMessage: `File exceeds maximum size of ${config.maxAttachmentSizeMb}MB` })
  }

  const ext = extname(filePart.filename)
  if (!isAllowedAttachment(ext, filePart.type ?? '')) {
    throw createError({ statusCode: 415, statusMessage: 'File type not allowed' })
  }

  const relativePath = `${ATTACHMENTS_DIR}/${sanitizeAttachmentFilename(filePart.filename)}`

  let absolutePath: string
  try {
    absolutePath = resolveVaultPath(relativePath, config.vaultPath)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid path' })
  }

  try {
    await mkdir(dirname(absolutePath), { recursive: true })
    await writeFile(absolutePath, filePart.data)
    return { path: relativePath }
  } catch (err) {
    console.error('attachment.post.ts: failed to write attachment at', absolutePath, err)
    throw createError({ statusCode: 500, statusMessage: 'Failed to save attachment' })
  }
})
