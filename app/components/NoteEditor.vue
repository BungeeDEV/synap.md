<script setup lang="ts">
import { completionKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { defaultHighlightStyle, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { Compartment, EditorState, Prec } from '@codemirror/state'
import { drawSelection, EditorView, keymap } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { colors, fontFamily, withAlpha } from '#shared/design-tokens'
import { livePreview } from '~/editor/livePreview'
import { slashCommandTrigger } from '~/editor/slashCommandTrigger'
import { smartEditing } from '~/editor/smartEditing'
import { wikilinkAutocomplete } from '~/editor/wikilinkAutocomplete'
import { uploadAttachment } from '~/utils/attachmentUpload'

// Graduated accent opacity per heading level (plus weight/size) instead of
// distinct hues - STYLEGUIDE.md's "ein einziger Akzentton" principle stays
// intact while headings/emphasis/links/code are still visually distinct at
// a glance. Tag names come from @lezer/markdown's styleTags map (ATXHeading1
// -> tags.heading1, StrongEmphasis -> tags.strong, etc.) - the markdown
// parser doesn't know about wikilinks, so `[[...]]` isn't separately styled
// here (only in the rendered NoteReader output).
const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, color: colors.accent, fontWeight: '700', fontSize: '1.3em' },
  { tag: tags.heading2, color: withAlpha(colors.accent, 0.85), fontWeight: '700', fontSize: '1.15em' },
  { tag: tags.heading3, color: withAlpha(colors.accent, 0.7), fontWeight: '600', fontSize: '1.08em' },
  { tag: tags.heading4, color: withAlpha(colors.accent, 0.6), fontWeight: '600' },
  { tag: tags.heading5, color: withAlpha(colors.accent, 0.5), fontWeight: '600' },
  { tag: tags.heading6, color: withAlpha(colors.accent, 0.45), fontWeight: '600', fontStyle: 'italic' },
  { tag: tags.strong, color: colors.contentPrimary, fontWeight: '700' },
  { tag: tags.emphasis, color: colors.contentPrimary, fontStyle: 'italic' },
  { tag: tags.strikethrough, color: colors.contentTertiary, textDecoration: 'line-through' },
  { tag: tags.link, color: colors.accent, textDecoration: 'underline' },
  { tag: tags.url, color: colors.accent },
  { tag: tags.monospace, color: colors.contentPrimary, backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  { tag: tags.quote, color: colors.contentSecondary, fontStyle: 'italic' },
  { tag: tags.list, color: colors.contentSecondary },
  { tag: tags.atom, color: colors.accent },
  { tag: tags.labelName, color: colors.contentSecondary },
  { tag: tags.string, color: colors.contentSecondary },
  { tag: tags.comment, color: colors.contentTertiary, fontStyle: 'italic' },
  { tag: tags.escape, color: colors.contentTertiary },
  // The literal markup characters (#, **, `, >, -, [ ]() ...) stay dimmer
  // than the content they wrap, a common editor convention for keeping
  // rendered text readable while still showing raw Markdown syntax.
  { tag: tags.processingInstruction, color: colors.contentTertiary }
])

const props = defineProps<{ path: string }>()

const tabs = useTabsStore()
const preferences = usePreferencesStore()
const { saving, conflict, save, saveNow, keepMine, loadTheirs } = useAutosave(props.path)
const { setView: setActiveEditorView } = useActiveEditorView()

const tab = computed(() => tabs.tabs.find((t) => t.path === props.path))
const mode = computed(() => tab.value?.viewMode ?? 'code')

const editorContainer = ref<HTMLDivElement | null>(null)
const attachmentInputRef = ref<HTMLInputElement | null>(null)
let view: EditorView | null = null
let syncingFromStore = false
const livePreviewCompartment = new Compartment()

interface PendingUploadMarker { from: number, to: number }
const pendingUploads: PendingUploadMarker[] = []

function errorMessageOf(err: unknown, fallback: string): string {
  const statusMessage = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
  return statusMessage ?? fallback
}

/** Inserts an "Uploading..." placeholder at the cursor, uploads `file`, then replaces the placeholder with the final Markdown syntax (or removes it on failure). */
async function insertAttachment(file: File): Promise<void> {
  if (!view) return
  const pos = view.state.selection.main.from
  const placeholder = '![Uploading...]()'

  view.dispatch({
    changes: { from: pos, insert: placeholder },
    selection: { anchor: pos + placeholder.length }
  })

  const marker: PendingUploadMarker = { from: pos, to: pos + placeholder.length }
  pendingUploads.push(marker)

  try {
    const result = await uploadAttachment(file)
    const markdown = file.type.startsWith('image/')
      ? `![${file.name}](${result.path})`
      : `[${file.name}](${result.path})`
    view?.dispatch({ changes: { from: marker.from, to: marker.to, insert: markdown } })
  } catch (err) {
    view?.dispatch({ changes: { from: marker.from, to: marker.to, insert: '' } })
    useToast().show(errorMessageOf(err, 'Upload fehlgeschlagen'), 'error')
  } finally {
    const index = pendingUploads.indexOf(marker)
    if (index !== -1) pendingUploads.splice(index, 1)
  }
}

// "Bild"/"Datei-Anhang" slash commands only ever get an EditorView, not
// access to insertAttachment() above - they set this shared request instead
// (see useAttachmentInsert.ts), and this watcher opens the native file
// picker. It's a one-shot trigger, not persistent modal state like the
// slash menu itself, so the flag is cleared right after opening the picker
// rather than waiting for a change/cancel event.
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

onMounted(() => {
  const tab = tabs.tabs.find((t) => t.path === props.path)
  if (!editorContainer.value || !tab) return

  view = new EditorView({
    parent: editorContainer.value,
    state: EditorState.create({
      doc: tab.content,
      extensions: [
        history(),
        // base: markdownLanguage (not the bare default) opts into GFM -
        // strikethrough/task-lists/tables/autolinks don't parse at all
        // otherwise, which left tags.strikethrough above dead and meant
        // "- [ ] todo" was just plain text with no Task/TaskMarker nodes
        // for livePreview.ts to render as a checkbox.
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(markdownHighlightStyle),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        // Without this, CodeMirror falls back to the native contenteditable
        // caret, whose color it derives from its own `&light`/`&dark`
        // baseTheme selector rather than our theme - we never marked our
        // theme as dark (see below), so it defaulted to a black caret on
        // this near-black background. drawSelection() also activates the
        // `.cm-cursor`/`.cm-dropCursor` layer our theme below already styles.
        drawSelection(),
        livePreviewCompartment.of(mode.value === 'live' ? [livePreview()] : []),
        wikilinkAutocomplete(),
        smartEditing(),
        slashCommandTrigger(),
        keymap.of([
          { key: 'Mod-s', preventDefault: true, run: () => { saveNow(); return true } },
          ...defaultKeymap,
          ...historyKeymap
        ]),
        // Needed for Enter/Escape/Arrow keys to accept/dismiss the wikilink
        // autocomplete popup - autocompletion() itself doesn't install these.
        // Prec.high keeps it below the slash-menu's Prec.highest bindings
        // and above defaultKeymap, without ever conflicting in practice
        // (the two popups' trigger conditions are mutually exclusive).
        Prec.high(keymap.of(completionKeymap)),
        // Read once at mount, not reactively - preferences apply to newly
        // opened tabs only, per the settings spec (already-open tabs keep
        // their current state instead of reloading mid-edit).
        ...(preferences.preferences.lineWrap ? [EditorView.lineWrapping] : []),
        EditorView.domEventHandlers({
          paste: (event) => {
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
          drop: (event) => {
            const files = event.dataTransfer?.files
            if (!files || files.length === 0) return false
            event.preventDefault()
            // Brief explicitly rules out a multi-file progress list -
            // sequential upload is enough.
            void (async () => {
              for (const file of Array.from(files)) {
                await insertAttachment(file)
              }
            })()
            return true
          }
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            // Keep pending-upload placeholder markers aligned through any
            // edits (e.g. the user kept typing elsewhere) that happen while
            // an upload is in flight.
            for (const marker of pendingUploads) {
              marker.from = update.changes.mapPos(marker.from)
              marker.to = update.changes.mapPos(marker.to, 1)
            }
          }
          if (!update.docChanged || syncingFromStore) return
          tabs.updateContent(props.path, update.state.doc.toString())
          save()
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            backgroundColor: colors.base,
            color: colors.contentPrimary
          },
          '.cm-scroller': {
            overflow: 'auto',
            overscrollBehavior: 'contain',
            fontFamily: fontFamily.mono.join(', '),
            fontSize: `${preferences.preferences.editorFontSize}px`
          },
          // Left-aligned, full-width editor (no centered/narrow column) -
          // padding lives on the content box itself now instead of an outer
          // max-w wrapper, so long lines use the full pane width.
          '.cm-content': {
            padding: '1.25rem 2rem 8rem'
          },
          // Matches the read-only Preview's blockquote box (tailwind.config.ts
          // typography.blockquote) - QuoteMark concealment only hides the ">",
          // this gives the line the same accent-bar + soft-background weight.
          '.cm-blockquote-line': {
            borderLeft: `2px solid ${colors.accentSoft}`,
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            paddingLeft: '0.75rem'
          },
          '.cm-cursor, .cm-dropCursor': { borderLeftColor: colors.accent, borderLeftWidth: '2px' },
          '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: colors.accentSoft }
        }, { dark: true })
      ]
    })
  })

  view.focus()
  setActiveEditorView(view)
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
  setActiveEditorView(null)
})

// Only fires for changes that didn't originate in the editor itself, i.e.
// "externe Version laden" during conflict resolution - typing already
// updates the store via the updateListener above.
watch(
  () => tabs.tabs.find((t) => t.path === props.path)?.content,
  (content) => {
    if (content === undefined || !view || content === view.state.doc.toString()) return
    syncingFromStore = true
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } })
    syncingFromStore = false
  }
)

// Toggling into/out of "live" mode doesn't remount NoteEditor (index.vue
// only keys the component on the tab path, not the view mode - "reader"
// mode already relies on this to keep the CodeMirror instance alive while
// hidden), so the live-preview decorations are swapped via a Compartment
// instead of being baked into the extensions list at mount time.
watch(mode, (next) => {
  view?.dispatch({ effects: livePreviewCompartment.reconfigure(next === 'live' ? [livePreview()] : []) })
})
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col">
    <input ref="attachmentInputRef" type="file" class="hidden" @change="onAttachmentInputChange">

    <div class="flex h-11 shrink-0 items-center justify-between border-b border-border bg-surface-1 px-2">
      <EditorToolbar v-if="mode !== 'reader'" :get-view="() => view" />
      <div v-else />
      <ViewModeToggle
        :model-value="mode"
        @update:model-value="(next) => tabs.setViewMode(props.path, next)"
      />
    </div>

    <div class="grid min-h-0 flex-1" :class="mode === 'split' ? 'grid-cols-2 gap-4' : 'grid-cols-1'">
      <div class="min-h-0 overflow-hidden" :class="mode === 'reader' ? 'hidden' : 'h-full'">
        <div ref="editorContainer" class="h-full w-full" />
      </div>
      <NoteReader v-if="mode === 'split' || mode === 'reader'" :path="props.path" class="min-h-0" />
    </div>

    <BacklinksPanel v-if="mode !== 'code'" :path="props.path" />

    <SlashCommandMenu />

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
