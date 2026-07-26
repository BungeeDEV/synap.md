<script setup lang="ts">
import { Search, X } from 'lucide-vue-next'
import { extractHeadings, type Heading } from '~/utils/extractHeadings'

const OUTLINE_DEBOUNCE_MS = 250

const INDENT_CLASSES: Record<number, string> = {
  1: 'pl-2',
  2: 'pl-4',
  3: 'pl-6',
  4: 'pl-8',
  5: 'pl-10',
  6: 'pl-12'
}

const sidebarPanel = useSidebarPanelStore()
const tabs = useTabsStore()
const { view } = useActiveEditorView()

const activeTab = computed(() => tabs.activeTab)
const filterQuery = ref('')
const headings = ref<Heading[]>([])

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function recompute(): void {
  headings.value = activeTab.value?.content ? extractHeadings(activeTab.value.content) : []
}

// Tab switches recompute immediately (no lag on open), typing debounces so
// the regex scan doesn't run on every keystroke.
watch(() => activeTab.value?.path, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  recompute()
}, { immediate: true })

watch(() => activeTab.value?.content, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(recompute, OUTLINE_DEBOUNCE_MS)
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

const filteredHeadings = computed(() => {
  const query = filterQuery.value.trim().toLowerCase()
  if (!query) return headings.value
  return headings.value.filter((heading) => heading.text.toLowerCase().includes(query))
})

function jumpToHeading(heading: Heading): void {
  if (!view.value) return
  const lineNumber = Math.min(Math.max(heading.line, 1), view.value.state.doc.lines)
  const line = view.value.state.doc.line(lineNumber)
  view.value.dispatch({ selection: { anchor: line.from }, scrollIntoView: true })
  view.value.focus()
}
</script>

<template>
  <div class="flex h-full min-h-0 touch-manipulation select-none flex-col">
    <div class="flex h-11 shrink-0 items-center justify-between border-b border-border px-2">
      <span class="text-sm font-medium tracking-wider text-content-tertiary uppercase">Outline</span>
      <button
        type="button"
        class="rounded-md p-3 text-content-secondary transition-colors duration-150 hover:bg-white/[0.04] md:p-2"
        title="Zurück zum Explorer"
        @click="sidebarPanel.setPanel('explorer')"
      >
        <X class="h-5 w-5" stroke-width="1.5" />
      </button>
    </div>

    <div v-if="activeTab" class="flex min-h-0 flex-1 flex-col">
      <div class="flex items-center gap-2 border-b border-border px-2.5 py-2">
        <Search class="h-4 w-4 shrink-0 text-content-tertiary" stroke-width="1.5" />
        <input
          v-model="filterQuery"
          type="text"
          placeholder="Filter headings..."
          class="w-full bg-transparent text-base text-content-primary placeholder:text-content-tertiary focus:outline-none"
        >
      </div>

      <div class="flex-1 overflow-y-auto overscroll-contain p-1">
        <p v-if="!filteredHeadings.length" class="p-2 text-base text-content-tertiary">
          Keine Überschriften gefunden
        </p>
        <ul v-else class="space-y-0.5">
          <li v-for="(heading, i) in filteredHeadings" :key="`${heading.line}-${i}`">
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded-md py-2 pr-2 text-left transition-colors duration-150 hover:bg-white/[0.04]"
              :class="INDENT_CLASSES[heading.level]"
              @click="jumpToHeading(heading)"
            >
              <span class="shrink-0 font-mono text-sm text-content-tertiary">H{{ heading.level }}</span>
              <span class="truncate text-base text-content-secondary">{{ heading.text }}</span>
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div v-else class="flex flex-1 items-center justify-center text-center text-sm text-content-tertiary">
      Keine Datei geöffnet
    </div>
  </div>
</template>
