<script setup lang="ts">
import { NoteEditor as BaseNoteEditor } from '@synap/ui-vue'
import { appState } from '../store'

const props = defineProps<{ 
  modelValue: string, 
  isReaderMode?: boolean 
}>()
const emit = defineEmits(['update:modelValue', 'save'])

function focusEditorIfOutsideContent(event: MouseEvent) {
  // Not needed here anymore since the wrapper in BaseNoteEditor handles it
}

async function handleAttachmentInsert(type: 'image' | 'file', handler: (file: File) => Promise<string>) {
  // Wait, Tauri handles file dialog natively usually, but for now we'll just mock it or use an input
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = type === 'image' ? 'image/*' : ''
  input.onchange = async () => {
    const file = input.files?.[0]
    if (file) {
      // we would do tauri upload here...
      const id = await handler(file)
      // and then update the placeholder using editor-core
    }
  }
  input.click()
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
