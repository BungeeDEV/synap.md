<script setup lang="ts">
import { Settings } from 'lucide-vue-next'

const sidebarPanel = useSidebarPanelStore()
const vaultTree = useVaultTreeStore()
const mobileNav = useMobileNavStore()

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && mobileNav.isDrawerOpen) mobileNav.close()
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div
    v-if="mobileNav.isDrawerOpen"
    class="fixed inset-0 z-40 backdrop-blur-md bg-black/40 md:hidden"
    @click="mobileNav.close()"
  />

  <aside
    class="fixed inset-y-0 left-0 z-50 flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface-1 text-sm text-content-primary transition-transform duration-150 md:static md:z-auto md:translate-x-0"
    :class="mobileNav.isDrawerOpen ? 'translate-x-0' : '-translate-x-full'"
  >
    <div class="min-h-0 flex-1 pt-safe-t">
      <VaultTree v-if="sidebarPanel.activePanel === 'explorer'" />
      <OutlinePanel v-else />
    </div>

    <div class="flex shrink-0 touch-manipulation select-none items-center justify-between border-t border-border px-2 py-1.5 pb-safe-b">
      <span class="truncate text-xs text-content-tertiary">{{ vaultTree.stats.files }} Dateien, {{ vaultTree.stats.folders }} Ordner</span>
      <div class="flex shrink-0 items-center gap-1">
        <SidebarPanelSwitcher />
        <button
          type="button"
          class="rounded-md p-2.5 text-content-tertiary transition-colors duration-150 hover:bg-white/[0.04] hover:text-content-secondary md:p-1.5"
          title="Einstellungen"
          @click="navigateTo('/settings')"
        >
          <Settings class="h-4 w-4" stroke-width="1.5" />
        </button>
      </div>
    </div>
  </aside>
</template>
