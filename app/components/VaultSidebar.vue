<script setup lang="ts">
import { Archive, Check, ChevronDown, Folder, LayoutTemplate, List, Search, Settings, Star, Trash2 } from 'lucide-vue-next'
import { flattenFilesAndFolders } from '~/utils/fuzzyMatch'

const sidebarPanel = useSidebarPanelStore()
const vaultTree = useVaultTreeStore()
const mobileNav = useMobileNavStore()
const tabs = useTabsStore()
const { favorites } = useFavorites()
const { open: openCommandPalette } = useCommandPalette()

const showWorkspaceMenu = ref(false)

function toggleWorkspaceMenu(): void {
  showWorkspaceMenu.value = !showWorkspaceMenu.value
}

function selectPanel(panel: 'explorer' | 'outline'): void {
  sidebarPanel.setPanel(panel)
  showWorkspaceMenu.value = false
}

// Favorites store bare vault-relative paths (files or folders) - resolve
// against the live tree so a since-deleted/renamed favorite quietly drops
// out of the list instead of opening a 404 when clicked (favorites.ts
// intentionally doesn't prune the stored list itself, see its own comment).
const favoriteEntries = computed(() => {
  const byPath = new Map(flattenFilesAndFolders(vaultTree.tree).map((entry) => [entry.path, entry]))
  return favorites.value.map((path) => byPath.get(path)).filter((entry) => !!entry)
})

function openFavorite(entry: { path: string, type: 'file' | 'folder' }): void {
  if (entry.type === 'folder') {
    vaultTree.expand(entry.path)
    vaultTree.selectFolder(entry.path)
  } else {
    void tabs.openTab(entry.path)
  }
  mobileNav.close()
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && mobileNav.isDrawerOpen) mobileNav.close()
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Transition enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="opacity-0" leave-to-class="opacity-0">
    <div
      v-if="mobileNav.isDrawerOpen"
      class="fixed inset-0 z-40 backdrop-blur-md bg-black/40 md:hidden"
      @click="mobileNav.close()"
    />
  </Transition>

  <aside
    class="fixed inset-y-0 left-0 z-50 flex h-full w-80 shrink-0 flex-col border-r border-border bg-surface-1 text-base text-content-primary transition-transform duration-150 md:static md:z-auto md:translate-x-0"
    :class="[
      mobileNav.isDrawerOpen ? 'translate-x-0' : '-translate-x-full',
      sidebarPanel.collapsed ? 'md:hidden' : ''
    ]"
  >
    <div class="flex shrink-0 touch-manipulation select-none items-center justify-between border-b border-border px-3 py-2 pt-safe-t">
      <div class="relative">
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-md py-1 pl-1 pr-2 transition-colors duration-150 hover:bg-white/[0.04] active:scale-95"
          aria-haspopup="menu"
          :aria-expanded="showWorkspaceMenu"
          @click="toggleWorkspaceMenu"
        >
          <img src="/icons/icon-192.png" alt="" class="h-6 w-6 shrink-0 rounded-md">
          <span class="text-sm font-medium text-content-primary">synap</span>
          <ChevronDown class="h-3.5 w-3.5 shrink-0 text-content-tertiary" stroke-width="1.5" />
        </button>

        <div v-if="showWorkspaceMenu" class="fixed inset-0 z-40" @click="showWorkspaceMenu = false" />
        <Transition
          enter-active-class="transition duration-150 ease-out"
          leave-active-class="transition duration-100 ease-in"
          enter-from-class="scale-95 opacity-0"
          leave-to-class="scale-95 opacity-0"
        >
          <div
            v-if="showWorkspaceMenu"
            class="absolute top-full left-0 z-50 mt-1 min-w-44 origin-top-left rounded-lg border border-border-strong bg-surface-1 py-1 text-content-primary shadow-float"
          >
            <p class="px-3.5 pt-1.5 pb-1 text-xs font-medium tracking-wider text-content-tertiary uppercase">
              Ansicht
            </p>
            <button
              type="button"
              class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors duration-150 hover:bg-surface-2"
              @click="selectPanel('explorer')"
            >
              <Folder class="h-4 w-4 shrink-0" stroke-width="1.5" />
              <span class="flex-1">Explorer</span>
              <Check v-if="sidebarPanel.activePanel === 'explorer'" class="h-4 w-4 shrink-0 text-accent" stroke-width="1.5" />
            </button>
            <button
              type="button"
              class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors duration-150 hover:bg-surface-2"
              @click="selectPanel('outline')"
            >
              <List class="h-4 w-4 shrink-0" stroke-width="1.5" />
              <span class="flex-1">Gliederung</span>
              <Check v-if="sidebarPanel.activePanel === 'outline'" class="h-4 w-4 shrink-0 text-accent" stroke-width="1.5" />
            </button>
          </div>
        </Transition>
      </div>

      <div class="flex items-center gap-0.5">
        <button
          type="button"
          class="rounded-md p-3 text-content-tertiary transition duration-150 hover:bg-white/[0.04] hover:text-content-secondary active:scale-95 md:p-1.5"
          title="Suche (⌘K)"
          @click="openCommandPalette()"
        >
          <Search class="h-4 w-4" stroke-width="1.5" />
        </button>
        <button
          type="button"
          class="rounded-md p-3 text-content-tertiary transition duration-150 hover:bg-white/[0.04] hover:text-content-secondary active:scale-95 md:p-1.5"
          title="Einstellungen"
          @click="navigateTo('/settings')"
        >
          <Settings class="h-4 w-4" stroke-width="1.5" />
        </button>
      </div>
    </div>

    <div
      v-if="sidebarPanel.activePanel === 'explorer' && favoriteEntries.length"
      class="shrink-0 touch-manipulation select-none border-b border-border p-1"
    >
      <p class="px-2.5 pt-1.5 pb-1 text-xs font-medium tracking-wider text-content-tertiary uppercase">
        Favoriten
      </p>
      <ul class="space-y-0.5 pb-1">
        <li v-for="entry in favoriteEntries" :key="entry.path">
          <button
            type="button"
            data-no-edge-swipe
            class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors duration-150 active:bg-white/[0.06]"
            :class="tabs.activePath === entry.path ? 'bg-surface-2 font-medium text-content-primary' : 'text-content-secondary hover:bg-white/[0.04] hover:text-content-primary'"
            @click="openFavorite(entry)"
          >
            <Folder v-if="entry.type === 'folder'" class="h-4 w-4 shrink-0 text-content-tertiary" stroke-width="1.5" />
            <Star v-else class="h-4 w-4 shrink-0 text-accent" stroke-width="1.5" fill="currentColor" />
            <span class="flex-1 truncate">{{ entry.title }}</span>
          </button>
        </li>
      </ul>
    </div>

    <div class="min-h-0 flex-1">
      <VaultTree v-if="sidebarPanel.activePanel === 'explorer'" />
      <OutlinePanel v-else />
    </div>

    <!--
      Papierkorb/Vorlagen/Archiv leben serverseitig außerhalb des Vault-Baums
      (SPECIAL_FOLDERS, siehe server/utils/specialFolders.ts) und werden nur
      über die Settings-Tabs verwaltet - deshalb feste Links dorthin statt
      (nicht existierender) Baumknoten.
    -->
    <div class="shrink-0 touch-manipulation select-none space-y-0.5 border-t border-border p-1">
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-content-secondary transition duration-150 hover:bg-white/[0.04] hover:text-content-primary active:scale-95"
        @click="navigateTo('/settings?tab=templates')"
      >
        <LayoutTemplate class="h-4 w-4 shrink-0" stroke-width="1.5" />
        Vorlagen
      </button>
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-content-secondary transition duration-150 hover:bg-white/[0.04] hover:text-content-primary active:scale-95"
        @click="navigateTo('/settings?tab=archive')"
      >
        <Archive class="h-4 w-4 shrink-0" stroke-width="1.5" />
        Archiv
      </button>
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-content-secondary transition duration-150 hover:bg-white/[0.04] hover:text-content-primary active:scale-95"
        @click="navigateTo('/settings?tab=trash')"
      >
        <Trash2 class="h-4 w-4 shrink-0" stroke-width="1.5" />
        Papierkorb
      </button>
    </div>

    <div class="shrink-0 touch-manipulation select-none border-t border-border px-3 py-2 pb-safe-b text-sm text-content-tertiary">
      {{ vaultTree.stats.files }} Dateien, {{ vaultTree.stats.folders }} Ordner
    </div>
  </aside>
</template>
