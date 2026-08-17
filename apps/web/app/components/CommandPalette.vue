<script setup lang="ts">
import { File, FileQuestion, SearchX } from '@lucide/vue'
import { flattenFiles, fuzzyMatchFiles } from '~/utils/fuzzyMatch'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface ContentResult {
  path: string
  title: string
  snippet: string
}

interface FlatResult {
  kind: 'file' | 'content'
  path: string
  title: string
  snippet?: string
}

const commandPalette = useCommandPalette()
const vaultTree = useVaultTreeStore()
const tabs = useTabsStore()

const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const resultsRef = ref<HTMLDivElement | null>(null)
const resultRefs = ref<(HTMLElement | null)[]>([])

const contentResults = ref<ContentResult[]>([])
const searchLoading = ref(false)
const showContentGroup = computed(() => query.value.trim().length > 0)

const fileResults = computed(() => {
  const allFiles = flattenFiles(vaultTree.tree)
  if (!query.value.trim()) {
    const recent = tabs.tabs.map((tab) => ({ path: tab.path, title: tab.title }))
    return (recent.length ? recent : allFiles).slice(0, 8)
  }
  return fuzzyMatchFiles(query.value, allFiles, 8)
})

const flatResults = computed<FlatResult[]>(() => [
  ...fileResults.value.map((file): FlatResult => ({ kind: 'file', path: file.path, title: file.title })),
  ...(showContentGroup.value
    ? contentResults.value.map((result): FlatResult => ({ kind: 'content', path: result.path, title: result.title, snippet: result.snippet }))
    : [])
])

const hasAnyResults = computed(() => flatResults.value.length > 0)
// Distinguishes "nothing in the vault yet" from "searched, found nothing" -
// both hit the same hasAnyResults=false branch otherwise, but deserve
// different copy/icon (a genuinely empty vault isn't a failed search).
const isVaultEmpty = computed(() => !query.value.trim() && vaultTree.tree.length === 0)

function flatIndexOf(kind: 'file' | 'content', localIndex: number): number {
  return kind === 'file' ? localIndex : fileResults.value.length + localIndex
}

function isSelected(kind: 'file' | 'content', localIndex: number): boolean {
  return selectedIndex.value === flatIndexOf(kind, localIndex)
}

function openResult(result: FlatResult | undefined): void {
  if (!result) return
  void tabs.openTab(result.path)
  commandPalette.close()
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
let searchToken = 0

watch(query, (q) => {
  selectedIndex.value = 0
  if (searchTimer) clearTimeout(searchTimer)

  const trimmed = q.trim()
  if (!trimmed) {
    contentResults.value = []
    searchLoading.value = false
    return
  }

  searchLoading.value = true
  searchTimer = setTimeout(async () => {
    const token = ++searchToken
    try {
      const results = await $fetch<ContentResult[]>('/api/search', { query: { q: trimmed } })
      if (token === searchToken) contentResults.value = results
    } catch {
      if (token === searchToken) contentResults.value = []
    } finally {
      if (token === searchToken) searchLoading.value = false
    }
  }, 250)
})

// rehype-sanitize isn't in play here - /api/search's snippet is our own
// trusted server response with only <mark> tags baked in (see
// server/api/search.get.ts) - but <mark>'s default yellow background has no
// place in this theme, and there's no Tailwind-class equivalent for
// styling markup injected via v-html, so it's classList-patched here after
// render (same approach NoteReader.vue uses for broken wikilinks).
watch(contentResults, async () => {
  await nextTick()
  resultsRef.value?.querySelectorAll('mark').forEach((el) => {
    el.classList.add('bg-accent/20', 'text-content-primary', 'rounded-sm', 'not-italic')
  })
})

watch(selectedIndex, async () => {
  await nextTick()
  resultRefs.value[selectedIndex.value]?.scrollIntoView({ block: 'nearest' })
})

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (flatResults.value.length) selectedIndex.value = Math.min(selectedIndex.value + 1, flatResults.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (flatResults.value.length) selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    openResult(flatResults.value[selectedIndex.value])
  } else if (event.key === 'Escape') {
    event.preventDefault()
    commandPalette.close()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  void nextTick(() => inputRef.value?.focus())
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<template>
  <Transition appear enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="opacity-0" leave-to-class="opacity-0">
    <div class="fixed inset-0 z-50 flex items-center justify-center md:backdrop-blur-md md:bg-black/40" @click="commandPalette.close()">
      <Transition appear enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="md:scale-95 md:opacity-0" leave-to-class="md:scale-95 md:opacity-0">
        <div
          class="flex h-full w-full flex-col border-border-strong bg-surface-1 pt-safe-t md:mx-4 md:h-auto md:max-w-xl md:rounded-xl md:border md:shadow-float"
          @click.stop
        >
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            :placeholder="t('palette.searchNotes')"
            class="w-full border-b border-border bg-transparent px-4 py-4 text-xl text-content-primary placeholder:text-content-tertiary focus:outline-none md:py-3.5 md:text-lg"
          >

          <div ref="resultsRef" class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 md:max-h-96 md:flex-none">
            <template v-if="hasAnyResults">
              <div class="mb-1">
                <p class="px-2 py-1.5 text-sm font-medium tracking-wider text-content-tertiary uppercase">
                  Dateien
                </p>
                <ul>
                  <li v-for="(file, i) in fileResults" :key="`file-${file.path}`">
                    <button
                      :ref="(el) => (resultRefs[flatIndexOf('file', i)] = el as HTMLElement)"
                      type="button"
                      class="flex w-full touch-manipulation items-center gap-2.5 rounded-md px-2.5 py-2.5 text-left transition-colors duration-150"
                      :class="isSelected('file', i) ? 'bg-surface-2' : 'hover:bg-white/[0.04]'"
                      @click="openResult(flatResults[flatIndexOf('file', i)])"
                      @mouseenter="selectedIndex = flatIndexOf('file', i)"
                    >
                      <File class="h-5 w-5 shrink-0 text-content-tertiary" stroke-width="1.5" />
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-base text-content-primary">{{ file.title }}</span>
                        <span class="block truncate text-sm text-content-tertiary">{{ file.path }}</span>
                      </span>
                    </button>
                  </li>
                </ul>
              </div>

              <div v-if="showContentGroup" class="mb-1">
                <p class="px-2 py-1.5 text-sm font-medium tracking-wider text-content-tertiary uppercase">
                  Inhalt
                </p>
                <p v-if="searchLoading && !contentResults.length" class="px-2.5 py-2 text-base text-content-tertiary">
                  Sucht…
                </p>
                <ul>
                  <li v-for="(result, i) in contentResults" :key="`content-${result.path}`">
                    <button
                      :ref="(el) => (resultRefs[flatIndexOf('content', i)] = el as HTMLElement)"
                      type="button"
                      class="flex w-full touch-manipulation flex-col gap-0.5 rounded-md px-2.5 py-2.5 text-left transition-colors duration-150"
                      :class="isSelected('content', i) ? 'bg-surface-2' : 'hover:bg-white/[0.04]'"
                      @click="openResult(flatResults[flatIndexOf('content', i)])"
                      @mouseenter="selectedIndex = flatIndexOf('content', i)"
                    >
                      <span class="truncate text-base text-content-primary">{{ result.title }}</span>
                      <span class="truncate text-sm text-content-tertiary italic" v-html="result.snippet" />
                    </button>
                  </li>
                </ul>
              </div>
            </template>

            <div v-else-if="isVaultEmpty" class="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <FileQuestion class="h-7 w-7 text-content-tertiary" stroke-width="1.5" />
              <p class="text-base text-content-tertiary">
                Noch keine Notizen im Vault
              </p>
              <p class="text-sm text-content-tertiary">
                Leg über „+ Neue Note" in der Seitenleiste deine erste Notiz an.
              </p>
            </div>
            <div v-else class="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <SearchX class="h-7 w-7 text-content-tertiary" stroke-width="1.5" />
              <p class="text-base text-content-tertiary">
                Keine Treffer für „{{ query.trim() }}"
              </p>
            </div>
          </div>

          <div class="flex shrink-0 items-center justify-between border-t border-border px-4 py-2.5 pb-safe-b font-mono text-sm text-content-tertiary">
            <span>{{ flatResults.length }} Treffer</span>
            <span>↑↓ navigieren · ↵ öffnen · esc schließen</span>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
