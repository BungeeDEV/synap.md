<script setup lang="ts">
import { Eye, PenLine } from '@lucide/vue'
import type { ViewMode } from '@synap/store'
import { RangeSlider, SegmentedControl } from '@synap/ui-vue'
import { useI18n } from 'vue-i18n'

const preferences = usePreferencesStore()
const { show } = useToast()
const { t } = useI18n()

// Just 2 modes now that the Tiptap editor is WYSIWYG/live-preview itself -
// see ViewModeToggle.vue.
const modes = computed(() => [
  { value: 'editor' as ViewMode, label: t('settings.modeEdit'), icon: PenLine },
  { value: 'reader' as ViewMode, label: t('settings.modeRead'), icon: Eye }
])

async function setDefaultViewMode(mode: ViewMode): Promise<void> {
  try {
    await preferences.update({ defaultViewMode: mode })
    show(t('settings.settingSaved'))
  } catch {
    show(t('settings.settingSaveFailed'), 'error')
  }
}

async function setFontSize(size: number): Promise<void> {
  try {
    await preferences.update({ editorFontSize: size })
  } catch {
    show(t('settings.settingSaveFailed'), 'error')
  }
}
</script>

<template>
  <div class="space-y-8">
    <section class="rounded-xl border border-border bg-surface-1 p-6">
      <h2 class="mb-4 text-sm font-semibold text-content-primary">
        {{ t('settings.defaultViewMode') }}
      </h2>
      <SegmentedControl :model-value="preferences.preferences.defaultViewMode" :options="modes" @update:model-value="setDefaultViewMode" />
    </section>

    <section class="rounded-xl border border-border bg-surface-1 p-6">
      <h2 class="mb-4 text-sm font-semibold text-content-primary">
        {{ t('settings.fontSize') }}
      </h2>
      <RangeSlider
        :model-value="preferences.preferences.editorFontSize"
        :min="10"
        :max="24"
        suffix="px"
        @update:model-value="setFontSize"
      />
    </section>
  </div>
</template>
