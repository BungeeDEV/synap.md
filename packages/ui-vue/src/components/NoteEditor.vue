<script setup lang="ts">
import { Extension } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { VueRenderer } from '@tiptap/vue-3'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import type { SlashCommand, FileEntry } from '@synap/editor-core'
import { buildEditorExtensions, insertUploadPlaceholder } from '@synap/editor-core'
import EditorBubbleMenu from './EditorBubbleMenu.vue'
import SlashCommandMenu from './SlashCommandMenu.vue'
import WikilinkSuggestionList from './WikilinkSuggestionList.vue'
import { onBeforeUnmount, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  fontSize?: number
  editable?: boolean
}>(), {
  fontSize: 16,
  editable: true
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'save': []
  'wikilink-navigate': [target: string]
  'attachment-insert': [type: 'image' | 'file', handler: (file: File) => Promise<string>]
}>()

const EditorHotkeys = Extension.create({
  name: 'editorHotkeys',
  addKeyboardShortcuts() {
    return {
      'Mod-s': () => {
        emit('save')
        return true
      },
      'Mod-Enter': () => this.editor.chain().focus().toggleTaskList().run()
    }
  }
})

const editor = useEditor({
  content: props.modelValue,
  editable: props.editable,
  extensions: [
    ...buildEditorExtensions({ 
      onWikilinkNavigate: (target) => emit('wikilink-navigate', target),
      slashCommandOptions: {
        onAttachmentInsert: (type) => {
          emit('attachment-insert', type, async (file: File) => {
             const isImage = file.type.startsWith('image/')
             const id = insertUploadPlaceholder(editor.value!, `${isImage ? 'Bild' : 'Datei'} wird hochgeladen: ${file.name}…`)
             return id
          })
        }
      },
      slashSuggestion: {
        render: () => {
          let component: VueRenderer
          return {
            onStart: (props: SuggestionProps<SlashCommand>) => {
              component = new VueRenderer(SlashCommandMenu, {
                props: { items: props.items, query: props.query, onSelect: (command: SlashCommand) => props.command(command) },
                editor: props.editor
              })
              props.mount(component.element as HTMLElement)
            },
            onUpdate: (props: SuggestionProps<SlashCommand>) => component.updateProps({ items: props.items, query: props.query }),
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') { component.destroy(); return true }
              return (component.ref as any)?.onKeyDown?.(props) ?? false
            },
            onExit: () => component.destroy()
          }
        }
      },
      wikilinkSuggestion: {
        render: () => {
          let component: VueRenderer
          return {
            onStart: (props: SuggestionProps<FileEntry>) => {
              component = new VueRenderer(WikilinkSuggestionList, {
                props: { items: props.items, onSelect: (file: FileEntry) => props.command(file) },
                editor: props.editor
              })
              props.mount(component.element as HTMLElement)
            },
            onUpdate: (props: SuggestionProps<FileEntry>) => component.updateProps({ items: props.items }),
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') { component.destroy(); return true }
              return (component.ref as any)?.onKeyDown?.(props) ?? false
            },
            onExit: () => component.destroy()
          }
        }
      }
    }),
    EditorHotkeys
  ],
  editorProps: {
    attributes: {
      class: 'prose max-w-none border-none shadow-none outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0',
      style: `font-size: ${props.fontSize ?? 16}px`
    }
  },
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.storage.markdown.getMarkdown())
  }
})

watch(() => props.modelValue, (newVal) => {
  if (editor.value && newVal !== editor.value.storage.markdown.getMarkdown()) {
    editor.value.commands.setContent(newVal, { emitUpdate: false })
  }
})

watch(() => props.editable, (newVal) => {
  if (editor.value) {
    editor.value.setEditable(newVal)
  }
})

onBeforeUnmount(() => {
  editor.value?.destroy()
})

function focusEditorIfOutsideContent(event: MouseEvent): void {
  const target = event.target as HTMLElement
  if (target.closest('.ProseMirror')) return
  editor.value?.chain().focus('end').run()
}
</script>

<template>
  <div
    class="h-full min-h-0 w-full flex-1 overflow-y-auto overscroll-contain bg-base"
    @mousedown="focusEditorIfOutsideContent"
  >
    <div class="relative mx-auto max-w-editor px-8 pt-16 pb-48">
      <EditorBubbleMenu v-if="editor" :editor="editor" />
      <EditorContent :editor="editor" />
    </div>
  </div>
</template>
