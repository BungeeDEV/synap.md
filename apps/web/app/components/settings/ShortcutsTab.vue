<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// This list is maintained by hand - there's no automatic shortcut discovery
// in this phase, so add new entries here whenever a new keybinding ships.
const shortcuts = computed(() => [
  { keys: ['Cmd/Ctrl', 'K'], description: t('desktopSettings.openCommandPalette') },
  { keys: ['Cmd/Ctrl', 'F'], description: t('desktopSettings.openSearch') },
  { keys: ['Cmd/Ctrl', 'Alt', 'N'], description: t('desktopSettings.createNote') },
  { keys: ['Cmd/Ctrl', '\\'], description: t('desktopSettings.toggleSidebar') },
  { keys: ['Cmd/Ctrl', 'S'], description: t('desktopSettings.saveNote') },
  { keys: ['Cmd/Ctrl', 'B'], description: t('desktopSettings.bold') },
  { keys: ['Cmd/Ctrl', 'I'], description: t('desktopSettings.italic') },
  { keys: ['Esc'], description: t('desktopSettings.closeDialog') },
  { keys: ['↑', '↓', 'Enter'], description: t('desktopSettings.navPalette') }
])
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="mb-4 text-xl font-semibold text-content-primary">{{ t('desktopSettings.shortcutsTitle') }}</h2>
      <ul class="divide-y divide-border">
        <li v-for="shortcut in shortcuts" :key="shortcut.description" class="flex items-center justify-between gap-4 py-3">
          <span class="text-sm text-content-secondary">{{ shortcut.description }}</span>
          <span class="flex shrink-0 items-center gap-1">
            <template v-for="(key, index) in shortcut.keys" :key="index">
              <span class="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-sm text-content-primary">{{ key }}</span>
            </template>
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
