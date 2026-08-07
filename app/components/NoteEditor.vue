<script setup lang="ts">
import { Extension } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { buildEditorExtensions } from '~/editor/tiptap/editorExtensions'
import { insertUploadPlaceholder, replaceUploadPlaceholder } from '~/editor/tiptap/uploadPlaceholder'
import { uploadAttachment } from '~/utils/attachmentUpload'

const props = defineProps<{ path: string }>()

const tabs = useTabsStore()
const preferences = usePreferencesStore()
const { saving, conflict, save, saveNow, keepMine, loadTheirs } = useAutosave(props.path)

const tab = computed(() => tabs.tabs.find((t) => t.path === props.path))
const mode = computed(() => tab.value?.viewMode ?? 'editor')

const attachmentInputRef = ref<HTMLInputElement | null>(null)

function errorMessageOf(err: unknown, fallback: string): string {
  const statusMessage = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
  return statusMessage ?? fallback
}

/** Inserts an upload-placeholder node at the cursor, uploads `file`, then replaces the placeholder with an image node (images) or a link-marked text run (any other file) - or removes it entirely on failure. */
async function insertAttachment(file: File): Promise<void> {
  if (!editor.value) return
  const isImage = file.type.startsWith('image/')
  const id = insertUploadPlaceholder(editor.value, `${isImage ? 'Bild' : 'Datei'} wird hochgeladen: ${file.name}…`)

  try {
    const result = await uploadAttachment(file)
    if (!editor.value) return
    const content = isImage
      ? { type: 'image', attrs: { src: result.path, alt: file.name } }
      : { type: 'text', text: file.name, marks: [{ type: 'link', attrs: { href: result.path } }] }
    replaceUploadPlaceholder(editor.value, id, content)
  } catch (err) {
    if (editor.value) replaceUploadPlaceholder(editor.value, id, null)
    useToast().show(errorMessageOf(err, 'Upload fehlgeschlagen'), 'error')
  }
}

// "Bild"/"Datei-Anhang" slash commands only ever get the Tiptap editor, not
// access to insertAttachment() above - they set this shared request instead
// (see useAttachmentInsert.ts), and this watcher opens the native file
// picker. One-shot trigger, cleared right after opening the picker rather
// than waiting for a change/cancel event.
const attachmentInsertRequest = useAttachmentInsertRequest()

watch(attachmentInsertRequest, (kind) => {
  if (!kind || !attachmentInputRef.value) return
  attachmentInputRef.value.accept = kind === 'image' ? 'image/*' : ''
  attachmentInputRef.value.click()
  attachmentInsertRequest.value = null
})

function onAttachmentInputChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) void insertAttachment(file)
}

/** Mod-S as a real ProseMirror keymap binding (not a DOM listener on the wrapper) - guaranteed to fire regardless of exactly which descendant of the contenteditable currently has focus. */
const SaveShortcut = Extension.create({
  name: 'saveShortcut',
  addKeyboardShortcuts() {
    return {
      'Mod-s': () => {
        saveNow()
        return true
      }
    }
  }
})

const editor = useEditor({
  content: tab.value?.content ?? '',
  extensions: [
    ...buildEditorExtensions({ onWikilinkNavigate: (path) => void tabs.openTab(path) }),
    SaveShortcut
  ],
  editorProps: {
    attributes: {
      // No width/centering/padding here anymore - the template's outer/inner
      // wrapper divs own the full-page-canvas layout now. `prose` (not
      // `-sm`) for the bigger Notion/Outline-style heading scale; `maxWidth:
      // 'none'` is already baked into tailwind.config.ts's typography.DEFAULT
      // so it doesn't fight the wrapper's own max-w-editor. `border-none
      // shadow-none outline-none` (both the plain and focus-visible variant,
      // overriding main.css's app-wide focus ring) so the content never
      // reads as a bordered "field", typing or not - text should look
      // written directly onto the page background.
      class: 'prose max-w-none border-none shadow-none outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0',
      style: `font-size: ${preferences.preferences.editorFontSize}px`
    },
    handlePaste: (_view, event) => {
      const items = event.clipboardData?.items
      if (!items) return false
      for (const item of items) {
        if (!item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (!file) continue
        event.preventDefault()
        void insertAttachment(file)
        return true
      }
      return false
    },
    handleDrop: (_view, event) => {
      const files = event.dataTransfer?.files
      if (!files || files.length === 0) return false
      event.preventDefault()
      // Brief explicitly rules out a multi-file progress list - sequential
      // upload is enough.
      void (async () => {
        for (const file of Array.from(files)) {
          await insertAttachment(file)
        }
      })()
      return true
    }
  },
  onUpdate: ({ editor }) => {
    tabs.updateContent(props.path, editor.storage.markdown.getMarkdown())
    save()
  }
})

/** Clicking anywhere in the padded canvas that ISN'T already inside the ProseMirror content itself (i.e. the breathing-room padding above/below/beside the text) focuses the editor at the end of the document - same "click below the last line to keep typing" affordance Notion/Obsidian give a full-page document. */
function focusEditorIfOutsideContent(event: MouseEvent): void {
  const target = event.target as HTMLElement
  if (target.closest('.ProseMirror')) return
  editor.value?.chain().focus('end').run()
}

// OutlinePanel.vue's jump-to-heading is a sidebar component outside this
// component's own subtree, so it needs a bridge to reach the live editor
// instance - same reasoning the old CM-era useActiveEditorView documented.
const { setEditor } = useActiveEditor()
watch(editor, (value) => setEditor(value ?? null), { immediate: true })

onBeforeUnmount(() => {
  setEditor(null)
  editor.value?.destroy()
})

// Only fires for changes that didn't originate in the editor itself, i.e.
// "externe Version laden" during conflict resolution - typing already
// updates the store via onUpdate above. `emitUpdate: false` suppresses the
// resulting onUpdate event natively, so no manual syncing-flag (the old CM
// version's `syncingFromStore`) is needed.
watch(
  () => tabs.tabs.find((t) => t.path === props.path)?.content,
  (content) => {
    if (content === undefined || !editor.value) return
    if (content === editor.value.storage.markdown.getMarkdown()) return
    editor.value.commands.setContent(content, { emitUpdate: false })
  }
)
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col">
    <input ref="attachmentInputRef" type="file" class="hidden" @change="onAttachmentInputChange">

    <!--
      No more full-width toolbar row (wasted vertical space, read as an extra
      "bar" of chrome above the document) - the mode toggle floats directly
      over the top-right corner of the editor pane instead, outside the
      scrolling container below so it stays put while the document scrolls
      underneath it. Only in editor mode - reader mode has its own
      DocumentBreadcrumb bar that hosts this same toggle inline instead
      (avoids the two floating independently and colliding in that corner).
    -->
    <div v-if="mode !== 'reader'" class="absolute right-6 top-4 z-30">
      <ViewModeToggle
        :model-value="mode"
        @update:model-value="(next) => tabs.setViewMode(props.path, next)"
      />
    </div>

    <!--
      Full-page-canvas layout: the editor is never a centered "widget" or
      bordered field - the whole scrollable area IS the document, same
      background as the rest of the app (no boxed-off sub-background). This
      one container is both the full-bleed canvas AND the scroll viewport
      (`h-full w-full flex-1 overflow-y-auto`, `min-h-0` is the standard
      flexbox fix that lets a flex child actually shrink/scroll instead of
      growing to fit its content); the only other wrapper is the reading/
      writing column itself (`max-w-editor mx-auto`), with generous - and
      deliberately asymmetric, more room at the bottom than the top -
      breathing room instead of a cramped centered box. Clicking the empty
      padding (not the text itself) still focuses the editor, like clicking
      below the last line in Notion/Obsidian.
    -->
    <div
      class="h-full min-h-0 w-full flex-1 overflow-y-auto overscroll-contain bg-base"
      :class="mode === 'reader' ? 'hidden' : ''"
      @mousedown="focusEditorIfOutsideContent"
    >
      <div class="relative mx-auto max-w-editor px-8 pt-16 pb-48">
        <EditorBubbleMenu v-if="editor" :editor="editor" />
        <EditorContent :editor="editor" />
      </div>
    </div>
    <NoteReader v-if="mode === 'reader'" :path="props.path" class="min-h-0 flex-1" />

    <BacklinksPanel :path="props.path" />

    <StatusBar :content="tab?.content ?? ''" :saving="saving" :conflict="!!conflict" />

    <Transition appear enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="opacity-0" leave-to-class="opacity-0">
      <div v-if="conflict" class="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md">
        <Transition appear enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="scale-95 opacity-0" leave-to-class="scale-95 opacity-0">
          <div class="w-full max-w-md rounded-xl border border-border-strong bg-surface-1 p-6 text-sm text-content-primary shadow-float">
            <h2 class="mb-2 font-semibold text-content-primary">
              Datei wurde extern geändert
            </h2>
            <p class="mb-4 text-content-secondary">
              Die Datei wurde außerhalb der App geändert, seit sie geladen wurde. Wie soll fortgefahren werden?
            </p>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                class="rounded-md bg-surface-2 px-4 py-2 text-content-primary transition-colors duration-150 hover:bg-white/[0.04]"
                @click="loadTheirs"
              >
                Externe Version laden
              </button>
              <button
                type="button"
                class="rounded-md border border-danger/40 bg-surface-2 px-4 py-2 text-danger transition-colors duration-150 hover:bg-danger/10"
                @click="keepMine"
              >
                Meine Version überschreiben
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>
