export interface AttachmentUploadResult {
  path: string
}

/** Uploads a single file to the vault's attachment store. Throws on error (size/type rejected, etc.) for the caller to catch and toast. */
export async function uploadAttachment(file: File): Promise<AttachmentUploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  return await $fetch<AttachmentUploadResult>('/api/vault/attachment', { method: 'POST', body: formData })
}
