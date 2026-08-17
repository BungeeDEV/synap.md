<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { 
  ArrowDown, ArrowUp, CornerDownLeft,
  Heading1, Heading2, Heading3, List, ListOrdered, ListTodo, Quote, Code, Link, AtSign, Image, Paperclip, Minus,
  Type, Bold, Italic, Strikethrough, Terminal, Highlighter, Table, Info, AlertTriangle, Sigma
} from '@lucide/vue'
import type { SlashCommand, SlashCommandGroup } from '@synap/editor-core'
import { ref, computed, watch, nextTick } from 'vue'

const IconMap: Record<string, any> = {
  Heading1, Heading2, Heading3, List, ListOrdered, ListTodo, Quote, Code, Link, AtSign, Image, Paperclip, Minus,
  Type, Bold, Italic, Strikethrough, Terminal, Highlighter, Table, Info, AlertTriangle, Sigma
}

interface GroupedSection {
  group: SlashCommandGroup
  label: string
  items: { command: SlashCommand, index: number }[]
}

const props = defineProps<{ items: SlashCommand[], query: string }>()
const emit = defineEmits<{ select: [command: SlashCommand] }>()

const selectedIndex = ref(0)

watch(() => props.items, () => { selectedIndex.value = 0 })

// Scroll selected item into view automatically
watch(selectedIndex, async (newIndex) => {
  await nextTick()
  const el = document.getElementById(`slash-command-item-${newIndex}`)
  if (el) {
    el.scrollIntoView({ block: 'nearest' })
  }
})

const groupedSections = computed<GroupedSection[]>(() => {
  const sections = new Map<SlashCommandGroup, GroupedSection>()
  props.items.forEach((command, index) => {
    let section = sections.get(command.group)
    if (!section) {
      section = { group: command.group, label: t('slashCommands.groups.' + command.group), items: [] }
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

function onKeyDown({ event }: { event: KeyboardEvent }): boolean {
  const count = props.items.length
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    selectedIndex.value = count ? (selectedIndex.value + 1) % count : 0
    return true
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    selectedIndex.value = count ? (selectedIndex.value - 1 + count) % count : 0
    return true
  }
  if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault()
    select(selectedIndex.value)
    return true
  }
  return false
}

defineExpose({ onKeyDown })
</script>

<template>
  <div class="absolute z-50 flex flex-col min-w-[16rem] w-64 origin-top-left rounded-xl border border-border-strong bg-surface-1 text-base text-content-primary shadow-float overflow-hidden">
    <div class="flex-1 overflow-y-auto max-h-[50vh] py-1 custom-scrollbar">
      <template v-if="items.length">
        <div v-for="section in groupedSections" :key="section.group">
          <p class="px-3.5 pt-2 pb-1 text-xs font-medium tracking-wider text-content-tertiary uppercase">
            {{ section.label }}
          </p>
          <ul>
            <li v-for="{ command, index } in section.items" :key="command.id">
              <button
                :id="`slash-command-item-${index}`"
                type="button"
                class="flex w-full items-center gap-2 px-3.5 py-2 text-left transition-colors duration-150"
                :class="index === selectedIndex ? 'bg-accent text-white' : 'hover:bg-white/[0.04]'"
                @click="select(index)"
                @mouseenter="selectedIndex = index"
              >
                <component
                  :is="IconMap[command.icon]"
                  class="h-5 w-5 shrink-0"
                  :class="index === selectedIndex ? 'text-white' : 'text-content-tertiary'"
                  stroke-width="1.5"
                />
                <span class="flex-1 truncate">{{ t('slashCommands.' + command.id) }}</span>
                <CornerDownLeft v-if="index === selectedIndex" class="h-3.5 w-3.5 shrink-0 text-white/70" stroke-width="1.5" />
              </button>
            </li>
          </ul>
        </div>
      </template>
      <p v-else class="px-3.5 py-2 text-content-tertiary">{{ t('editor.noResults') }}</p>
    </div>

    <div class="flex shrink-0 items-center justify-between gap-3 border-t border-border px-3.5 py-2 text-xs text-content-tertiary bg-surface-1">
      <span class="flex shrink-0 items-center gap-1.5">
        <span class="inline-flex items-center gap-0.5">
          <ArrowUp class="h-3 w-3" stroke-width="1.5" />
          <ArrowDown class="h-3 w-3" stroke-width="1.5" />
        </span>{{ t('editor.navigate') }}<CornerDownLeft class="h-3 w-3" stroke-width="1.5" />{{ t('editor.select') }}</span>
      <span v-if="query" class="truncate opacity-70">{{ query }}</span>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(150, 150, 150, 0.3);
  border-radius: 10px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: rgba(150, 150, 150, 0.5);
}
</style>
