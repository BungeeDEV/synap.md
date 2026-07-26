<script setup lang="ts">
import { filterSlashCommands } from '~/editor/slashCommands'
import { executeSlashCommand, useSlashCommandMenu } from '~/editor/slashCommandTrigger'

const menu = useSlashCommandMenu()
const { view } = useActiveEditorView()

const filtered = computed(() => (menu.value ? filterSlashCommands(menu.value.query) : []))

function select(index: number): void {
  const command = filtered.value[index]
  if (command && view.value) executeSlashCommand(view.value, command)
}
</script>

<template>
  <div
    v-if="menu"
    class="fixed z-50 min-w-48 rounded-xl border border-border-strong bg-surface-1 py-1 text-base text-content-primary shadow-float"
    :style="{ left: `${menu.coords.left}px`, top: `${menu.coords.top}px` }"
  >
    <ul v-if="filtered.length">
      <li v-for="(command, i) in filtered" :key="command.id">
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3.5 py-2 text-left transition-colors duration-150"
          :class="i === menu.selectedIndex ? 'bg-surface-2' : 'hover:bg-white/[0.04]'"
          @click="select(i)"
          @mouseenter="menu.selectedIndex = i"
        >
          <component :is="command.icon" class="h-5 w-5 shrink-0 text-content-tertiary" stroke-width="1.5" />
          {{ command.label }}
        </button>
      </li>
    </ul>
    <p v-else class="px-3.5 py-2 text-content-tertiary">
      Keine Treffer
    </p>
  </div>
</template>
