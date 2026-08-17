<script setup lang="ts">
import type { Editor } from '@tiptap/core'
import { BubbleMenu } from '@tiptap/vue-3/menus'
import { Bold, Code, Italic, Strikethrough } from '@lucide/vue'
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps<{ editor: Editor }>()

// Tiptap's Editor isn't a reactive Vue object (ProseMirror state changes
// don't flow through Vue's reactivity on their own), so button active-states
// are re-evaluated on every 'transaction' event via this trigger ref rather
// than computed properties that would otherwise never re-run.
const updateTrigger = ref(0)
function bump(): void { updateTrigger.value++ }

function isActive(name: string): boolean {
  void updateTrigger.value
  return props.editor.isActive(name)
}

const buttons = computed(() => [
  { name: 'bold', icon: Bold, label: t('slashCommands.bold'), action: () => props.editor.chain().focus().toggleBold().run() },
  { name: 'italic', icon: Italic, label: t('slashCommands.italic'), action: () => props.editor.chain().focus().toggleItalic().run() },
  { name: 'strike', icon: Strikethrough, label: t('slashCommands.strikethrough'), action: () => props.editor.chain().focus().toggleStrike().run() },
  { name: 'code', icon: Code, label: t('slashCommands.code'), action: () => props.editor.chain().focus().toggleCode().run() }
])

function shouldShow({ state }: { state: Editor['state'] }): boolean {
  return !state.selection.empty && state.doc.textBetween(state.selection.from, state.selection.to).trim().length > 0
}

onMounted(() => {
  props.editor.on('transaction', bump)
})

onBeforeUnmount(() => {
  props.editor.off('transaction', bump)
})
</script>

<template>
  <BubbleMenu :editor="editor" :should-show="shouldShow" :options="{ placement: 'top', offset: 8 }">
    <div class="bubble-menu flex items-center gap-0.5 rounded-lg border border-border-strong bg-surface-1 p-1 shadow-float" @mousedown.prevent.stop>
      <button
        v-for="button in buttons"
        :key="button.name"
        type="button"
        :title="button.label"
        class="rounded-md p-1.5 transition-colors duration-150"
        :class="isActive(button.name) ? 'bg-accent text-white' : 'text-content-secondary hover:bg-white/[0.04]'"
        @mousedown.prevent="button.action()"
      >
        <component :is="button.icon" class="h-4 w-4" stroke-width="1.75" />
      </button>
    </div>
  </BubbleMenu>
</template>
