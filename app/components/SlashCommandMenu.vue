<script setup lang="ts">
import { ArrowDown, ArrowUp, CornerDownLeft } from 'lucide-vue-next'
import type { SlashCommand, SlashCommandGroup } from '~/editor/slashCommands'
import { filterSlashCommands, SLASH_COMMAND_GROUP_LABELS } from '~/editor/slashCommands'
import { executeSlashCommand, useSlashCommandMenu } from '~/editor/slashCommandTrigger'

interface GroupedSection {
  group: SlashCommandGroup
  label: string
  items: { command: SlashCommand, index: number }[]
}

const menu = useSlashCommandMenu()
const { view } = useActiveEditorView()

const filtered = computed(() => (menu.value ? filterSlashCommands(menu.value.query) : []))

// Grouped purely for rendering (headers/dividers) - selectedIndex from
// slashCommandTrigger.ts still indexes into the flat `filtered` array, so
// each rendered item keeps its original flat index for selection/click.
const groupedSections = computed<GroupedSection[]>(() => {
  const sections = new Map<SlashCommandGroup, GroupedSection>()
  filtered.value.forEach((command, index) => {
    let section = sections.get(command.group)
    if (!section) {
      section = { group: command.group, label: SLASH_COMMAND_GROUP_LABELS[command.group], items: [] }
      sections.set(command.group, section)
    }
    section.items.push({ command, index })
  })
  return [...sections.values()]
})

function select(index: number): void {
  const command = filtered.value[index]
  if (command && view.value) executeSlashCommand(view.value, command)
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-150 ease-out"
    leave-active-class="transition duration-100 ease-in"
    enter-from-class="scale-95 opacity-0"
    leave-to-class="scale-95 opacity-0"
  >
    <div
      v-if="menu"
      class="fixed z-50 min-w-56 origin-top-left rounded-xl border border-border-strong bg-surface-1 py-1 text-base text-content-primary shadow-float"
      :style="{ left: `${menu.coords.left}px`, top: `${menu.coords.top}px` }"
    >
      <template v-if="filtered.length">
        <div v-for="section in groupedSections" :key="section.group">
          <p class="px-3.5 pt-2 pb-1 text-xs font-medium tracking-wider text-content-tertiary uppercase">
            {{ section.label }}
          </p>
          <ul>
            <li v-for="{ command, index } in section.items" :key="command.id">
              <button
                type="button"
                class="flex w-full items-center gap-2 px-3.5 py-2 text-left transition-colors duration-150"
                :class="index === menu.selectedIndex ? 'bg-accent text-white' : 'hover:bg-white/[0.04]'"
                @click="select(index)"
                @mouseenter="menu.selectedIndex = index"
              >
                <component
                  :is="command.icon"
                  class="h-5 w-5 shrink-0"
                  :class="index === menu.selectedIndex ? 'text-white' : 'text-content-tertiary'"
                  stroke-width="1.5"
                />
                <span class="flex-1 truncate">{{ command.label }}</span>
                <CornerDownLeft v-if="index === menu.selectedIndex" class="h-3.5 w-3.5 shrink-0 text-white/70" stroke-width="1.5" />
              </button>
            </li>
          </ul>
        </div>
      </template>
      <p v-else class="px-3.5 py-2 text-content-tertiary">
        Keine Treffer
      </p>

      <div class="flex items-center justify-between gap-3 border-t border-border px-3.5 py-2 text-xs text-content-tertiary">
        <span class="flex shrink-0 items-center gap-1.5">
          <span class="inline-flex items-center gap-0.5">
            <ArrowUp class="h-3 w-3" stroke-width="1.5" />
            <ArrowDown class="h-3 w-3" stroke-width="1.5" />
          </span>
          Navigieren
          <CornerDownLeft class="h-3 w-3" stroke-width="1.5" />
          Auswählen
        </span>
        <span v-if="menu.query" class="truncate">Weiter tippen zum Filtern…</span>
      </div>
    </div>
  </Transition>
</template>
