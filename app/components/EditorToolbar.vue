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

const buttons = [
  { icon: Bold, label: 'Fett', action: withView((view) => wrapSelection(view, '**')) },
  { icon: Italic, label: 'Kursiv', action: withView((view) => wrapSelection(view, '*')) },
  { icon: Code, label: 'Code', action: withView((view) => wrapSelection(view, '`')) },
  { icon: Heading, label: 'Überschrift', action: withView(cycleHeading) },
  { icon: List, label: 'Liste', action: withView(insertBulletList) },
  { icon: ListOrdered, label: 'Nummerierte Liste', action: withView(insertNumberedList) },
  { icon: ListTodo, label: 'Checkliste', action: withView(insertTaskList) },
  { icon: Quote, label: 'Zitat', action: withView(insertQuote) },
  { icon: Link, label: 'Link', action: withView(insertLink) },
  { icon: AtSign, label: 'Wikilink', action: withView(insertWikilink) }
] as const
</script>

<template>
  <div class="flex min-w-0 touch-manipulation select-none items-center gap-0.5 overflow-x-auto">
    <button
      v-for="button in buttons"
      :key="button.label"
      type="button"
      :title="button.label"
      class="shrink-0 rounded-md p-3 text-content-secondary transition-colors duration-150 hover:bg-white/[0.04] md:p-2"
      @click="button.action()"
    >
      <component :is="button.icon" class="h-5 w-5" stroke-width="1.5" />
    </button>
  </div>
</template>
