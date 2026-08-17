<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ChevronRight, FilePlus, FileText } from '@lucide/vue'

const { user, fetch: refreshSession } = useUserSession()
const tabs = useTabsStore()
// Destructured to a top-level binding rather than kept as `commandPalette.isOpen` -
// Vue only auto-unwraps refs in templates when they're direct top-level
// <script setup> bindings; a ref nested inside a plain returned object (like
// `commandPalette.isOpen`) is NOT unwrapped by `v-if`, since it only ever
// reads the Ref instance itself (always truthy) rather than tracking `.value`.
const { isOpen: isCommandPaletteOpen, toggle: toggleCommandPalette } = useCommandPalette()
const { triggerNewNote } = useNoteCreation()
const edgeSwipe = useEdgeSwipe()

async function handleLogout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await refreshSession()
  await navigateTo('/login')
}

// Condensed breadcrumb for the desktop header - same segment logic as
// DocumentBreadcrumb.vue (which only renders inside NoteReader's
// split/reader modes), kept as its own small computed here since the header
// itself is a different, always-present chrome bar, not worth extracting a
// shared util for one extra call site.
const headerSegments = computed(() => {
  const path = tabs.activeTab?.path
  if (!path) return []
  const parts = path.split('/')
  const file = parts.pop() ?? path
  return [...parts, file.replace(/\.md$/i, '')]
})

// Global keyboard shortcuts (Cmd/Ctrl+K, +F, +Alt+N, +\) live in
// useGlobalHotkeys.ts, registered once from app.vue - active on every route,
// not just this page.

// LazyNoteEditor below defers the editor's JS chunk (Tiptap + extensions)
// to first use, so the very first note a user opens in a session pays for
// a chunk download+parse on top of the file fetch, with no loading
// indicator for either. Warming it during idle time once the shell has
// settled means that cost is usually already paid by the time the user
// clicks a file. Importing the exact same module specifier Nuxt's `Lazy`
// wrapper resolves to shares its module cache entry, so the later "real"
// dynamic import just resolves the already-fetched module instead of
// fetching again.
function prefetchEditorChunk(): void {
  void import('~/components/NoteEditor.vue')
}

onMounted(() => {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(prefetchEditorChunk)
  } else {
    setTimeout(prefetchEditorChunk, 1000)
  }
})
</script>

<template>
  <div
    class="flex min-h-0 flex-1 overflow-hidden bg-base text-content-primary"
    @pointerdown="edgeSwipe.onPointerDown"
    @pointermove="edgeSwipe.onPointerMove"
    @pointerup="edgeSwipe.onPointerUp"
    @pointercancel="edgeSwipe.onPointerCancel"
  >
    <VaultSidebar />

    <main class="flex min-w-0 flex-1 flex-col">
      <MobileTopBar @logout="handleLogout" @open-command-palette="toggleCommandPalette" />

      <header class="hidden h-11 shrink-0 touch-manipulation select-none items-center justify-between gap-2 border-b border-border bg-surface-1 px-4 text-sm md:flex">
        <div class="flex min-w-0 items-center gap-1 text-content-tertiary">
          <span class="shrink-0 font-medium text-content-secondary">synap.md</span>
          <template v-if="headerSegments.length">
            <ChevronRight class="h-3.5 w-3.5 shrink-0" stroke-width="1.5" />
            <template v-for="(segment, index) in headerSegments" :key="index">
              <ChevronRight v-if="index > 0" class="h-3.5 w-3.5 shrink-0" stroke-width="1.5" />
              <span class="truncate" :class="index === headerSegments.length - 1 ? 'text-content-primary' : ''">{{ segment }}</span>
            </template>
          </template>
        </div>
        <UserMenu :username="user?.username" @logout="handleLogout" />
      </header>

      <TabBar v-if="tabs.tabs.length" />

      <div class="min-h-0 flex-1">
        <LazyNoteEditor v-if="tabs.activeTab" :key="tabs.activeTab.path" :path="tabs.activeTab.path" />
        <div v-else class="flex h-full flex-col items-center justify-center gap-3 text-content-tertiary">
          <FileText class="h-10 w-10" stroke-width="1.5" />
          <p class="text-base">{{ t('editor.noNoteOpen') }}</p>
          <button
            type="button"
            class="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm text-white transition duration-150 hover:bg-accent/90 active:scale-95 focus:outline-none focus:ring-1 focus:ring-accent/50"
            @click="triggerNewNote"
          >
            <FilePlus class="h-4 w-4" stroke-width="1.5" />{{ t('tree.createNewNote') }}</button>
        </div>
      </div>
    </main>

    <CommandPalette v-if="isCommandPaletteOpen" />
  </div>
</template>
