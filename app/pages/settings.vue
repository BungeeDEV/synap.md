<script setup lang="ts">
import { ArrowLeft, Archive, Download, HardDrive, Info, Keyboard, LayoutTemplate, Settings as SettingsIcon, Trash2, User } from 'lucide-vue-next'
import type { Component } from 'vue'
import AboutTab from '~/components/settings/AboutTab.vue'
import AccountTab from '~/components/settings/AccountTab.vue'
import ArchivePanel from '~/components/settings/ArchivePanel.vue'
import BackupTab from '~/components/settings/BackupTab.vue'
import EditorTab from '~/components/settings/EditorTab.vue'
import ShortcutsTab from '~/components/settings/ShortcutsTab.vue'
import TemplatesTab from '~/components/settings/TemplatesTab.vue'
import TrashPanel from '~/components/settings/TrashPanel.vue'
import VaultStatsTab from '~/components/settings/VaultStatsTab.vue'

interface SettingsTab {
  id: string
  label: string
  icon: Component
  component: Component
}

const tabs: SettingsTab[] = [
  { id: 'account', label: 'Account', icon: User, component: AccountTab },
  { id: 'editor', label: 'Editor', icon: SettingsIcon, component: EditorTab },
  { id: 'templates', label: 'Vorlagen', icon: LayoutTemplate, component: TemplatesTab },
  { id: 'vault', label: 'Vault & Speicher', icon: HardDrive, component: VaultStatsTab },
  { id: 'archive', label: 'Archiv', icon: Archive, component: ArchivePanel },
  { id: 'trash', label: 'Papierkorb', icon: Trash2, component: TrashPanel },
  { id: 'backup', label: 'Backup', icon: Download, component: BackupTab },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard, component: ShortcutsTab },
  { id: 'about', label: 'Über', icon: Info, component: AboutTab }
]

// Lets sidebar links (Papierkorb/Vorlagen system entries) deep-link straight
// into a tab via /settings?tab=trash instead of always landing on the first
// one - falls back silently to the default tab for an unknown/missing id.
const route = useRoute()
const requestedTabId = route.query.tab
const initialTabId = typeof requestedTabId === 'string' && tabs.some((tab) => tab.id === requestedTabId)
  ? requestedTabId
  : tabs[0]!.id

const activeTabId = ref(initialTabId)
const activeTab = computed(() => tabs.find((tab) => tab.id === activeTabId.value) ?? tabs[0]!)

const showMobileNav = ref(!requestedTabId || !tabs.some(tab => tab.id === requestedTabId))

function selectTab(id: string) {
  activeTabId.value = id
  showMobileNav.value = false
}
</script>

<template>
  <div class="flex min-h-0 flex-1 overflow-hidden bg-base text-content-primary">
    <aside
      class="w-full shrink-0 touch-manipulation select-none flex-col border-r border-border bg-surface-1 text-base md:flex md:w-72"
      :class="showMobileNav ? 'flex' : 'hidden'"
    >
      <div class="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <button
          type="button"
          class="rounded-md p-2.5 text-content-tertiary transition-colors duration-150 hover:bg-white/[0.04] hover:text-content-secondary"
          title="Zurück zum Editor"
          @click="navigateTo('/')"
        >
          <ArrowLeft class="h-5 w-5" stroke-width="1.5" />
        </button>
        <span class="text-content-primary">Einstellungen</span>
      </div>

      <nav class="flex-1 space-y-0.5 overflow-y-auto p-2">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
          :class="tab.id === activeTabId ? 'bg-surface-2 rounded-md text-content-primary' : 'rounded-md text-content-secondary transition-colors duration-150 hover:bg-white/[0.04]'"
          @click="selectTab(tab.id)"
        >
          <component :is="tab.icon" class="h-5 w-5 shrink-0" stroke-width="1.5" />
          {{ tab.label }}
        </button>
      </nav>
    </aside>

    <main
      class="min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-4 md:flex md:p-8"
      :class="!showMobileNav ? 'flex' : 'hidden'"
    >
      <div class="mb-4 flex h-11 shrink-0 items-center gap-2 border-b border-border pb-2 md:hidden">
        <button
          type="button"
          class="rounded-md p-2.5 text-content-tertiary transition-colors duration-150 hover:bg-white/[0.04] hover:text-content-secondary"
          title="Zurück zur Übersicht"
          @click="showMobileNav = true"
        >
          <ArrowLeft class="h-5 w-5" stroke-width="1.5" />
        </button>
        <span class="text-content-primary">{{ activeTab.label }}</span>
      </div>

      <div class="mx-auto w-full max-w-2xl">
        <component :is="activeTab.component" />
      </div>
    </main>
  </div>
</template>
