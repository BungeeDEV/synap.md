<script setup lang="ts">
// This list is maintained by hand - there's no automatic shortcut discovery
// in this phase, so add new entries here whenever a new keybinding ships.
const shortcuts = [
  { keys: ['Cmd/Ctrl', 'K'], description: 'Command Palette öffnen' },
  { keys: ['Cmd/Ctrl', 'S'], description: 'Note speichern' },
  { keys: ['Esc'], description: 'Dialog oder Palette schließen' },
  { keys: ['↑', '↓', 'Enter'], description: 'Navigation in Palette, Autocomplete und Slash-Menü' }
]
</script>

<template>
  <div>
    <h2 class="mb-3 border-b border-border pb-2 text-xl font-semibold">
      Shortcuts
    </h2>
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
</template>
