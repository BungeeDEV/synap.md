<script setup lang="ts">
import { NoteEditor as BaseNoteEditor } from '@synap/ui-vue'
import { useI18n } from 'vue-i18n'
import { uploadAttachment } from '~/utils/attachmentUpload'

const props = defineProps<{ path: string }>()

const tabs = useTabsStore()
const preferences = usePreferencesStore()
const { t } = useI18n()
const { saving, conflict, save, saveNow, keepMine, loadTheirs } = useAutosave(props.path)

const tab = computed(() => tabs.tabs.find((t) => t.path === props.path))
const mode = computed(() => tab.value?.viewMode ?? 'editor')

const attachmentInputRef = ref<HTMLInputElement | null>(null)
const editorRef = ref<{ replacePlaceholder: (id: string, content: Record<string, unknown> | null) => void } | null>(null)

function errorMessageOf(err: unknown, fallback: string): string {
  const statusMessage = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
  return statusMessage ?? fallback
}

async function handleAttachmentInsert(type: 'image' | 'file', handler: (file: File) => Promise<string>) {
  // Let the user pick a file
  attachmentInputRef.value!.accept = type === 'image' ? 'image/*' : ''
  attachmentInputRef.value!.click()

  // We need a way to pass the picked file back to the handler.
  // We can attach a one-time event listener to the input
  const onFilePicked = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    attachmentInputRef.value!.removeEventListener('change', onFilePicked)

    if (file) {
      // handler() inserts the upload placeholder synchronously and returns
      // its id; the placeholder is only resolved into real content (or
      // dropped on failure) once the upload itself settles below.
      const id = await handler(file)
      try {
        const result = await uploadAttachment(file)
        const content = type === 'image'
          ? { type: 'image', attrs: { src: result.path, alt: file.name } }
          : { type: 'text', text: file.name, marks: [{ type: 'link', attrs: { href: result.path } }] }
        editorRef.value?.replacePlaceholder(id, content)
      } catch (err) {
        editorRef.value?.replacePlaceholder(id, null)
        useToast().show(errorMessageOf(err, t('editor.uploadFailed')), 'error')
      }
    }
  }
  attachmentInputRef.value!.addEventListener('change', onFilePicked)
}

watch(
  () => tabs.tabs.find((t) => t.path === props.path)?.content,
  (newContent) => {
    if (newContent !== undefined && tab.value) {
      tab.value.content = newContent
    }
  }
)
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col">
    <input ref="attachmentInputRef" type="file" class="hidden">

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

    <div
      class="h-full min-h-0 w-full flex-1 bg-base"
      :class="mode === 'reader' ? 'hidden' : ''"
    >
      <BaseNoteEditor
        v-if="tab"
        ref="editorRef"
        v-model="tab.content"
        :font-size="preferences.preferences.editorFontSize"
        @save="saveNow"
        @wikilink-navigate="(target) => tabs.openTab(target)"
        @attachment-insert="(type, handler) => handleAttachmentInsert(type, handler)"
      />
    </div>
    <NoteReader v-if="mode === 'reader'" :path="props.path" class="min-h-0 flex-1" />

    <BacklinksPanel :path="props.path" />

    <StatusBar :content="tab?.content ?? ''" :saving="saving" :conflict="!!conflict" />

    <Transition appear enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="opacity-0" leave-to-class="opacity-0">
      <div v-if="conflict" class="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md">
        <Transition appear enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="scale-95 opacity-0" leave-to-class="scale-95 opacity-0">
          <div class="w-full max-w-md rounded-xl border border-border-strong bg-surface-1 p-6 text-sm text-content-primary shadow-float">
            <h2 class="mb-2 font-semibold text-content-primary">
              {{ t('conflict.title') }}
            </h2>
            <p class="mb-4 text-content-secondary">
              {{ t('conflict.message') }}
            </p>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                class="rounded-md bg-surface-2 px-4 py-2 text-content-primary transition-colors duration-150 hover:bg-white/[0.04]"
                @click="loadTheirs"
              >
                {{ t('conflict.loadExternal') }}
              </button>
              <button
                type="button"
                class="rounded-md border border-danger/40 bg-surface-2 px-4 py-2 text-danger transition-colors duration-150 hover:bg-danger/10"
                @click="keepMine"
              >
                {{ t('conflict.keepMine') }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </div>
</template>
