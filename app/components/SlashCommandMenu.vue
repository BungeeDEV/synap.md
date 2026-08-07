<script setup lang="ts">
import { ArrowDown, ArrowUp, CornerDownLeft } from 'lucide-vue-next'
import type { SlashCommand, SlashCommandGroup } from '~/editor/slashCommands'
import { SLASH_COMMAND_GROUP_LABELS } from '~/editor/slashCommands'

interface GroupedSection {
  group: SlashCommandGroup
  label: string
  items: { command: SlashCommand, index: number }[]
}

// Rendered ad-hoc via `VueRenderer` from slashSuggestion.ts's `render()`
// callbacks (Suggestion's own popup-lifecycle contract), not as a child in
// NoteEditor.vue's template - positioning is handled entirely by the
// Suggestion plugin's `props.mount()` (Floating UI), so this component only
// ever needs `position: absolute` for that to take over.
const props = defineProps<{ items: SlashCommand[], query: string }>()
const emit = defineEmits<{ select: [command: SlashCommand] }>()

const selectedIndex = ref(0)

watch(() => props.items, () => { selectedIndex.value = 0 })

// Grouped purely for rendering (headers/dividers) - selectedIndex still
// indexes into the flat `items` array, so each rendered item keeps its
// original flat index for selection/click.
const groupedSections = computed<GroupedSection[]>(() => {
  const sections = new Map<SlashCommandGroup, GroupedSection>()
  props.items.forEach((command, index) => {
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
  const command = props.items[index]
  if (command) emit('select', command)
}

/** Called by slashSuggestion.ts's `render().onKeyDown` - returns true if the key was handled (stops the editor's own keymap from also acting on it). */
function onKeyDown({ event }: { event: KeyboardEvent }): boolean {
  const count = props.items.length
  if (event.key === 'ArrowDown') {
    selectedIndex.value = count ? (selectedIndex.value + 1) % count : 0
    return true
  }
  if (event.key === 'ArrowUp') {
    selectedIndex.value = count ? (selectedIndex.value - 1 + count) % count : 0
    return true
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    select(selectedIndex.value)
    return true
  }
  return false
}

defineExpose({ onKeyDown })
</script>

<template>
  <div class="absolute z-50 min-w-56 origin-top-left rounded-xl border border-border-strong bg-surface-1 py-1 text-base text-content-primary shadow-float">
    <template v-if="items.length">
      <div v-for="section in groupedSections" :key="section.group">
        <p class="px-3.5 pt-2 pb-1 text-xs font-medium tracking-wider text-content-tertiary uppercase">
          {{ section.label }}
        </p>
        <ul>
          <li v-for="{ command, index } in section.items" :key="command.id">
            <button
              type="button"
              class="flex w-full items-center gap-2 px-3.5 py-2 text-left transition-colors duration-150"
              :class="index === selectedIndex ? 'bg-accent text-white' : 'hover:bg-white/[0.04]'"
              @click="select(index)"
              @mouseenter="selectedIndex = index"
            >
              <component
                :is="command.icon"
                class="h-5 w-5 shrink-0"
                :class="index === selectedIndex ? 'text-white' : 'text-content-tertiary'"
                stroke-width="1.5"
              />
              <span class="flex-1 truncate">{{ command.label }}</span>
              <CornerDownLeft v-if="index === selectedIndex" class="h-3.5 w-3.5 shrink-0 text-white/70" stroke-width="1.5" />
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
      <span v-if="query" class="truncate">Weiter tippen zum Filtern…</span>
    </div>
  </div>
</template>
