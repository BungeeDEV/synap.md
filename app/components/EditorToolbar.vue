<script setup lang="ts">
import type { EditorView } from '@codemirror/view'
import {
  AtSign,
  Bold,
  Code,
  Heading,
  Italic,
  Link,
  List,
  ListOrdered,
  ListTodo,
  Quote
} from 'lucide-vue-next'

const props = defineProps<{ getView: () => EditorView | null }>()

function withView(action: (view: EditorView) => void): () => void {
  return () => {
    const view = props.getView()
    if (view) action(view)
  }
}

// `group` drives the vertical dividers in the template - bumped by one
// wherever a new logical cluster starts (text formatting / headings /
// lists+quote / links), same grouping idea as the slash-menu's section
// headers, just rendered as separators instead since this toolbar has no
// room for labeled headers.
const buttons = [
  { icon: Bold, label: 'Fett', action: withView((view) => wrapSelection(view, '**')), group: 0 },
  { icon: Italic, label: 'Kursiv', action: withView((view) => wrapSelection(view, '*')), group: 0 },
  { icon: Code, label: 'Code', action: withView((view) => wrapSelection(view, '`')), group: 0 },
  { icon: Heading, label: 'Überschrift', action: withView(cycleHeading), group: 1 },
  { icon: List, label: 'Liste', action: withView(insertBulletList), group: 2 },
  { icon: ListOrdered, label: 'Nummerierte Liste', action: withView(insertNumberedList), group: 2 },
  { icon: ListTodo, label: 'Checkliste', action: withView(insertTaskList), group: 2 },
  { icon: Quote, label: 'Zitat', action: withView(insertQuote), group: 2 },
  { icon: Link, label: 'Link', action: withView(insertLink), group: 3 },
  { icon: AtSign, label: 'Wikilink', action: withView(insertWikilink), group: 3 }
] as const
</script>

<template>
  <div class="flex min-w-0 touch-manipulation select-none items-center gap-0.5 overflow-x-auto">
    <template v-for="(button, index) in buttons" :key="button.label">
      <div v-if="index > 0 && button.group !== buttons[index - 1]!.group" class="mx-1 h-5 w-px shrink-0 bg-border" />
      <button
        type="button"
        :title="button.label"
        class="shrink-0 rounded-md p-3 text-content-secondary transition duration-150 hover:bg-white/[0.04] active:scale-95 md:p-2"
        @click="button.action()"
      >
        <component :is="button.icon" class="h-5 w-5" stroke-width="1.5" />
      </button>
    </template>
  </div>
</template>
