<script setup lang="ts">
import { ref } from 'vue'
import { NoteEditor as BaseNoteEditor } from '@synap/ui-vue'
import { open } from '@tauri-apps/plugin-dialog'
import { copyFile, mkdir } from '@tauri-apps/plugin-fs'
import { useI18n } from 'vue-i18n'
import { appState } from '../store'

const { t } = useI18n()

const props = defineProps<{
  modelValue: string,
  isReaderMode?: boolean
}>()
const emit = defineEmits(['update:modelValue', 'save'])

// BaseNoteEditor exposes replacePlaceholder() (see packages/ui-vue) so a
// parent can resolve an in-flight upload placeholder without reaching into
// editor-core itself - needed below once the picked file is actually copied
// into the vault.
const editorRef = ref<{ replacePlaceholder: (id: string, content: Record<string, unknown> | null) => void } | null>(null)

function focusEditorIfOutsideContent(event: MouseEvent) {
  // Not needed here anymore since the wrapper in BaseNoteEditor handles it
}

// Mirrors apps/web/server/utils/attachments.ts's allow-list/filename
// convention, so a desktop-inserted attachment lands exactly where a
// server-uploaded one would (_attachments/, same timestamp-prefixed
// collision-safe name, same restricted extension set).
const ATTACHMENT_MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf'
}

function sanitizeAttachmentFilename(originalName: string): string {
  const dotIndex = originalName.lastIndexOf('.')
  const ext = (dotIndex > -1 ? originalName.slice(dotIndex) : '').replace(/[^a-zA-Z0-9.]/g, '').toLowerCase()
  const base = dotIndex > -1 ? originalName.slice(0, dotIndex) : originalName
  const cleanedBase = base.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'file'
  return `${Date.now()}-${cleanedBase}${ext}`
}

async function handleAttachmentInsert(type: 'image' | 'file', handler: (file: File) => Promise<string>) {
  if (!appState.vaultPath) return

  const selected = await open({
    multiple: false,
    filters: [{
      name: type === 'image' ? 'Images' : 'Files',
      extensions: type === 'image' ? ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] : ['pdf']
    }]
  })
  if (!selected || Array.isArray(selected)) return

  const sourcePath = selected
  const fileName = sourcePath.split(/[\\/]/).pop() ?? 'file'
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : ''
  const mimeType = ATTACHMENT_MIME_BY_EXT[ext]
  if (!mimeType) {
    appState.statusMsg = t('desktopApp.attachmentTypeNotAllowed')
    return
  }

  // The placeholder only needs a name/type (see insertUploadPlaceholder in
  // editor-core) - the actual copy below goes native-path to native-path
  // through Tauri's fs plugin, so there's no need to read the file's bytes
  // into JS memory at all.
  const id = await handler(new File([], fileName, { type: mimeType }))

  try {
    const attachmentsDir = `${appState.vaultPath}/_attachments`
    const destName = sanitizeAttachmentFilename(fileName)
    const destRelPath = `_attachments/${destName}`

    await mkdir(attachmentsDir, { recursive: true })
    await copyFile(sourcePath, `${attachmentsDir}/${destName}`)

    const content = type === 'image'
      ? { type: 'image', attrs: { src: destRelPath, alt: fileName } }
      : { type: 'text', text: fileName, marks: [{ type: 'link', attrs: { href: destRelPath } }] }
    editorRef.value?.replacePlaceholder(id, content)
  } catch (e: any) {
    editorRef.value?.replacePlaceholder(id, null)
    appState.statusMsg = t('desktopApp.genericError', { error: e })
  }
}
</script>

<style>
.dynamic-editor {
  font-size: var(--editor-font-size);
  line-height: var(--editor-line-height);
  font-family: var(--editor-font-family);
}
.dynamic-editor p {
  line-height: var(--editor-line-height);
}
</style>

<template>
  <BaseNoteEditor
    ref="editorRef"
    :model-value="modelValue"
    @update:model-value="(val) => emit('update:modelValue', val)"
    :font-size="appState.editorFontSize"
    :editable="!isReaderMode"
    @save="() => emit('save')"
    @wikilink-navigate="(target) => console.log('Navigate to', target)"
    @attachment-insert="handleAttachmentInsert"
    class="dynamic-editor"
    :style="{
      '--editor-font-size': appState.editorFontSize + 'px',
      '--editor-line-height': appState.editorLineHeight,
      '--editor-font-family': appState.editorFontFamily === 'serif' ? 'Georgia, serif' : appState.editorFontFamily === 'mono' ? '\'JetBrains Mono\', ui-monospace, monospace' : 'Inter, system-ui, sans-serif'
    }"
  />
</template>
