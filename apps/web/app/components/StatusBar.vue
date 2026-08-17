<script setup lang="ts">
import { AlertTriangle, Check, Cloud } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { countChars, countWords } from '~/utils/textStats'

const props = defineProps<{ content: string, saving: boolean, conflict: boolean }>()
const { t } = useI18n()

const wordCount = computed(() => countWords(props.content))
const charCount = computed(() => countChars(props.content))

const statusLabel = computed(() => {
  if (props.conflict) return t('statusBar.conflict')
  if (props.saving) return t('share.saving')
  return t('statusBar.saved')
})

// Monochrome by default (VS Code/Obsidian-style status bar, not a colored
// badge) - conflict is the one state that stays red, since that's a real
// problem the user needs to notice, not a routine save tick.
const statusIcon = computed(() => (props.conflict ? AlertTriangle : props.saving ? Cloud : Check))
const statusIconClass = computed(() => (props.conflict ? 'text-danger' : 'text-content-tertiary'))

// Brief scale "pop" on the icon right when a save completes (saving -> not
// saving, no conflict) - a quieter alternative to a toast for something
// that happens this often.
const justSaved = ref(false)
let flashTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.saving, (saving, wasSaving) => {
  if (!wasSaving || saving || props.conflict) return
  justSaved.value = true
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => { justSaved.value = false }, 500)
})

onBeforeUnmount(() => { if (flashTimer) clearTimeout(flashTimer) })
</script>

<template>
  <div class="flex h-6 w-full shrink-0 touch-manipulation select-none items-center justify-between border-t border-border px-3 text-xs text-content-tertiary">
    <span>{{ wordCount }} {{ t('actions.words') }} · {{ charCount }} {{ t('actions.chars') }}</span>
    <span class="flex items-center gap-1.5" :class="conflict ? 'text-danger' : ''">
      <component
        :is="statusIcon"
        class="h-3.5 w-3.5 shrink-0 transition-transform duration-300"
        :class="[statusIconClass, justSaved ? 'scale-125' : 'scale-100']"
        stroke-width="1.75"
      />
      {{ statusLabel }}
    </span>
  </div>
</template>
