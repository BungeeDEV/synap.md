<script setup lang="ts">
import { Archive, Check, ChevronDown, Folder, LayoutTemplate, List, Search, Settings, Star, Trash2 } from '@lucide/vue'
import { flattenFilesAndFolders } from '~/utils/fuzzyMatch'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const sidebarPanel = useSidebarPanelStore()
const vaultTree = useVaultTreeStore()
const mobileNav = useMobileNavStore()
const tabs = useTabsStore()
const { favorites } = useFavorites()
const { open: openCommandPalette } = useCommandPalette()

// Shared with VaultTree.vue's overflow/template menus via the same useState
// key, so at most one sidebar dropdown/menu is ever open at a time - see the
// comment on VaultTree.vue's own `activeTreeMenu` declaration.
const activeTreeMenu = useState<'overflow' | 'template' | 'workspace' | null>('vaultActiveTreeMenu', () => null)
// VaultTree.vue's row/folder context menu - not opened from here, but must
// be dismissed if the workspace menu opens while it's showing.
const treeContextMenu = useState<unknown | null>('vaultTreeContextMenu', () => null)
const showWorkspaceMenu = computed(() => activeTreeMenu.value === 'workspace')

function toggleWorkspaceMenu(): void {
  treeContextMenu.value = null
  activeTreeMenu.value = activeTreeMenu.value === 'workspace' ? null : 'workspace'
}

function selectPanel(panel: 'explorer' | 'outline'): void {
  sidebarPanel.setPanel(panel)
  activeTreeMenu.value = null
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
    <div class="flex shrink-0 touch-manipulation select-none items-center justify-between border-b border-white/[0.03] px-6 py-4">
      <div class="relative">
        <button
          type="button"
          class="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors duration-150 hover:bg-white/[0.04] active:scale-95"
          aria-haspopup="menu"
          :aria-expanded="showWorkspaceMenu"
          @click="toggleWorkspaceMenu"
        >
          <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#F5A623] to-[#D97706] text-[13px] font-bold text-white shadow-sm m-0">S</div>
          <span class="block text-lg font-semibold leading-none tracking-tight text-content-primary m-0">synap</span>
          <ChevronDown class="h-4 w-4 shrink-0 text-content-tertiary m-0" stroke-width="1.5" />
        </button>

        <!-- Teleported: without this, `fixed inset-0` resolves against this
             component's own <aside> (its containing block, since it always
             carries a transform - see ContextMenu.vue's Teleport comment)
             and only covers the 320px sidebar column. -->
        <Teleport to="body">
          <div v-if="showWorkspaceMenu" class="fixed inset-0 z-40" @click="activeTreeMenu = null" />
        </Teleport>
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
              {{ t('sidebar.view') }}
            </p>
            <button
              type="button"
              class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors duration-150 hover:bg-surface-2"
              @click="selectPanel('explorer')"
            >
              <Folder class="h-4 w-4 shrink-0" stroke-width="1.5" />
              <span class="flex-1">{{ t('sidebar.explorer') }}</span>
              <Check v-if="sidebarPanel.activePanel === 'explorer'" class="h-4 w-4 shrink-0 text-accent" stroke-width="1.5" />
            </button>
            <button
              type="button"
              class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors duration-150 hover:bg-surface-2"
              @click="selectPanel('outline')"
            >
              <List class="h-4 w-4 shrink-0" stroke-width="1.5" />
              <span class="flex-1">{{ t('sidebar.outline') }}</span>
              <Check v-if="sidebarPanel.activePanel === 'outline'" class="h-4 w-4 shrink-0 text-accent" stroke-width="1.5" />
            </button>
          </div>
        </Transition>
      </div>

      <div class="flex items-center gap-4">
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-content-tertiary transition-colors duration-150 hover:bg-white/[0.08] hover:text-content-primary active:scale-95"
          :title="t('sidebar.search')"
          @click="openCommandPalette()"
        >
          <Search class="h-5 w-5" stroke-width="1.5" />
        </button>
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-content-tertiary transition-colors duration-150 hover:bg-white/[0.08] hover:text-content-primary active:scale-95"
          :title="t('sidebar.settings')"
          @click="navigateTo('/settings')"
        >
          <Settings class="h-5 w-5" stroke-width="1.5" />
        </button>
      </div>
    </div>

    <div
      v-if="sidebarPanel.activePanel === 'explorer' && favoriteEntries.length"
      class="shrink-0 touch-manipulation select-none border-b border-border p-1"
    >
      <p class="px-2.5 pt-1.5 pb-1 text-[10px] font-medium tracking-wider text-content-tertiary uppercase">
        {{ t('sidebar.favorites') }}
      </p>
      <ul class="space-y-0.5 pb-1">
        <li v-for="entry in favoriteEntries" :key="entry.path">
          <button
            type="button"
            data-no-edge-swipe
            class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors duration-150 active:bg-white/[0.06]"
            :class="tabs.activePath === entry.path ? 'bg-accent/[0.12] text-content-primary' : 'text-content-secondary hover:bg-[#252525] hover:text-content-primary'"
            @click="openFavorite(entry)"
          >
            <Folder v-if="entry.type === 'folder'" class="h-4 w-4 shrink-0 text-content-tertiary/60" stroke-width="1.5" />
            <Star v-else class="h-3.5 w-3.5 shrink-0 text-accent" stroke-width="1.5" fill="currentColor" />
            <span class="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
              <span v-if="tabs.activePath === entry.path" class="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span class="truncate">{{ entry.title }}</span>
            </span>
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
    <div class="shrink-0 touch-manipulation select-none border-t border-border p-1">
      <p class="px-2.5 pt-1.5 pb-1 text-[10px] font-medium tracking-wider text-content-tertiary uppercase">
        {{ t('sidebar.library') }}
      </p>
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-content-secondary transition duration-150 hover:bg-[#252525] hover:text-content-primary active:scale-95"
        @click="navigateTo('/settings?tab=templates')"
      >
        <LayoutTemplate class="h-4 w-4 shrink-0 text-content-tertiary/60" stroke-width="1.5" />
        {{ t('sidebar.templates') }}
      </button>
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-content-secondary transition duration-150 hover:bg-[#252525] hover:text-content-primary active:scale-95"
        @click="navigateTo('/settings?tab=archive')"
      >
        <Archive class="h-4 w-4 shrink-0 text-content-tertiary/60" stroke-width="1.5" />
        {{ t('sidebar.archive') }}
      </button>
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-content-secondary transition duration-150 hover:bg-[#252525] hover:text-content-primary active:scale-95"
        @click="navigateTo('/settings?tab=trash')"
      >
        <Trash2 class="h-4 w-4 shrink-0 text-content-tertiary/60" stroke-width="1.5" />
        {{ t('sidebar.trash') }}
      </button>
    </div>

    <div class="shrink-0 touch-manipulation select-none border-t border-border px-3 py-2 pb-safe-b text-xs text-content-tertiary/50">
      {{ t('sidebar.files', { count: vaultTree.stats.files }) }} &middot; {{ t('sidebar.folders', { count: vaultTree.stats.folders }) }}
    </div>
  </aside>
</template>
