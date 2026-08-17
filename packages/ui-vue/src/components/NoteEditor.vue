<script setup lang="ts">
import { Extension } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { VueRenderer } from '@tiptap/vue-3'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import type { SlashCommand, FileEntry } from '@synap/editor-core'
import { buildEditorExtensions, insertUploadPlaceholder, replaceUploadPlaceholder } from '@synap/editor-core'
import EditorBubbleMenu from './EditorBubbleMenu.vue'
import SlashCommandMenu from './SlashCommandMenu.vue'
import WikilinkSuggestionList from './WikilinkSuggestionList.vue'
import PropertiesPanel from './PropertiesPanel.vue'
import yaml from 'yaml'
import * as prettier from 'prettier/standalone'
import * as markdownPlugin from 'prettier/plugins/markdown'
import { onBeforeUnmount, watch, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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
      'Alt-Shift-f': () => {
        const currentMarkdown = this.editor.storage.markdown.getMarkdown()
        prettier.format(currentMarkdown, {
          parser: 'markdown',
          plugins: [markdownPlugin]
        }).then((formatted) => {
          this.editor.commands.setContent(rawFrontmatterStr.value + formatted, { emitUpdate: true })
        }).catch(err => console.error("Formatting failed:", err))
        return true
      },
      'Mod-Enter': () => this.editor.chain().focus().toggleTaskList().run()
    }
  }
})

const frontmatter = ref<Record<string, any> | null>(null)
const rawFrontmatterStr = ref<string>('')

function extractFrontmatter(md: string) {
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (match) {
    rawFrontmatterStr.value = match[0]
    try {
      frontmatter.value = yaml.parse(match[1])
    } catch {
      frontmatter.value = null
    }
    return md.slice(match[0].length)
  }
  rawFrontmatterStr.value = ''
  frontmatter.value = null
  return md
}

const editor = useEditor({
  content: extractFrontmatter(props.modelValue),
  editable: props.editable,
  extensions: [
    ...buildEditorExtensions({
      onWikilinkNavigate: (target) => emit('wikilink-navigate', target),
      placeholder: t('editor.placeholderPrompt'),
      slashCommandOptions: {
        onAttachmentInsert: (type) => {
          emit('attachment-insert', type, async (file: File) => {
             const isImage = file.type.startsWith('image/')
             const id = insertUploadPlaceholder(editor.value!, isImage ? t('editor.uploadingImage', { name: file.name }) : t('editor.uploadingFile', { name: file.name }))
             return id
          })
        },
        linkPromptLabel: t('slashCommands.linkPromptLabel')
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
    emit('update:modelValue', rawFrontmatterStr.value + editor.storage.markdown.getMarkdown())
  }
})

watch(() => props.modelValue, (newVal) => {
  const mdWithoutFm = extractFrontmatter(newVal)
  if (editor.value && mdWithoutFm !== editor.value.storage.markdown.getMarkdown()) {
    editor.value.commands.setContent(mdWithoutFm, { emitUpdate: false })
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
  // Only act if user clicked the wrapper itself, not any element inside it
  if (target !== event.currentTarget) return
  // Prevent any native focus delegation or scroll jump
  event.preventDefault()
  event.stopPropagation()
}

/** Lets the parent resolve a pending upload placeholder (see `attachment-insert`'s handler) once the upload settles, without the parent needing its own reference into `@synap/editor-core`. */
function replacePlaceholder(id: string, content: Record<string, unknown> | null): void {
  if (editor.value) replaceUploadPlaceholder(editor.value, id, content)
}

defineExpose({ replacePlaceholder })
</script>

<template>
  <div
    class="h-full min-h-0 w-full flex-1 overflow-y-auto overscroll-contain bg-base"
  >
    <div
      class="relative mx-auto max-w-editor px-8 pt-16 pb-48"
      @mousedown="focusEditorIfOutsideContent"
    >
      <PropertiesPanel v-if="frontmatter" :frontmatter="frontmatter" />
      <EditorBubbleMenu v-if="editor" :editor="editor" />
      <EditorContent :editor="editor" />
    </div>
  </div>
</template>
