<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { Extension } from '@tiptap/core'
import { appState } from '../store'

const props = defineProps<{ 
  modelValue: string, 
  isReaderMode?: boolean 
}>()
const emit = defineEmits(['update:modelValue', 'save'])

const EditorHotkeys = Extension.create({
  name: 'editorHotkeys',
  addKeyboardShortcuts() {
    return {
      'Mod-s': () => {
        // Explizites Speichern per Hotkey simulieren (triggert Autosave-Logik)
        emit('update:modelValue', this.editor.storage.markdown.getMarkdown())
        return true
      },
      'Mod-Enter': () => this.editor.chain().focus().toggleTaskList().run()
    }
  }
})

const editor = useEditor({
  content: props.modelValue,
  editable: !props.isReaderMode,
  extensions: [
    StarterKit,
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown,
    Placeholder.configure({ placeholder: 'Schreibe deine Notiz...' }),
    EditorHotkeys
  ],
  editorProps: {
    attributes: {
      class: 'prose max-w-none border-none shadow-none outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 dynamic-editor'
    }
  },
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.storage.markdown.getMarkdown())
  }
})

watch(() => props.modelValue, (value) => {
  if (editor.value && editor.value.storage.markdown.getMarkdown() !== value) {
    editor.value.commands.setContent(value, { emitUpdate: false })
  }
})

watch(() => props.isReaderMode, (isReader) => {
  if (editor.value) {
    editor.value.setEditable(!isReader)
  }
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})

function focusEditorIfOutsideContent(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target.closest('.ProseMirror')) return
  editor.value?.chain().focus('end').run()
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
  <div class="h-full min-h-0 w-full flex-1 overflow-y-auto overscroll-contain bg-base" @mousedown="focusEditorIfOutsideContent">
    <div 
      class="relative mx-auto max-w-[750px] px-8 pt-16 pb-48"
      :style="{
        '--editor-font-size': appState.editorFontSize + 'px',
        '--editor-line-height': appState.editorLineHeight,
        '--editor-font-family': appState.editorFontFamily === 'serif' ? 'Georgia, serif' : appState.editorFontFamily === 'mono' ? 'var(--font-mono)' : 'var(--font-sans)'
      }"
    >
      <EditorContent :editor="editor" v-if="editor" />
    </div>
  </div>
</template>
