<script setup lang="ts">
import { X } from '@lucide/vue'
import { useI18n } from 'vue-i18n'

const tabs = useTabsStore()
const pendingClosePath = ref<string | null>(null)
const { t } = useI18n()

function selectTab(path: string): void {
  tabs.setActiveTab(path)
}

function closeTab(path: string, event: MouseEvent): void {
  event.stopPropagation()
  const tab = tabs.tabs.find((t) => t.path === path)
  if (tab?.dirty) {
    pendingClosePath.value = path
    return
  }
  tabs.closeTab(path)
}

function confirmClose(): void {
  if (pendingClosePath.value) tabs.closeTab(pendingClosePath.value)
  pendingClosePath.value = null
}
</script>

<template>
  <div data-no-edge-swipe class="flex h-11 shrink-0 touch-manipulation select-none overflow-x-auto border-b border-border bg-surface-1 text-base">
    <button
      v-for="tab in tabs.tabs"
      :key="tab.path"
      type="button"
      class="group flex shrink-0 items-center gap-2 border-r border-border px-4 transition-colors duration-150 active:bg-white/[0.06]"
      :class="tab.path === tabs.activePath ? 'bg-surface-2 text-content-primary' : 'text-content-tertiary hover:bg-white/[0.04] hover:text-content-secondary'"
      @click="selectTab(tab.path)"
    >
      <span>{{ tab.title }}</span>
      <span
        class="flex h-5 w-5 items-center justify-center rounded transition duration-150 hover:bg-white/[0.06] active:scale-90"
        :title="t('common.close')"
        @click="closeTab(tab.path, $event)"
      >
        <span v-if="tab.dirty" class="h-1.5 w-1.5 rounded-full bg-content-tertiary group-hover:hidden" />
        <X class="h-3.5 w-3.5" stroke-width="1.5" :class="tab.dirty ? 'hidden group-hover:inline' : 'inline'" />
      </span>
    </button>
  </div>

  <ConfirmDialog
    v-if="pendingClosePath"
    :title="t('tabs.discardChangesTitle')"
    :message="t('tabs.discardChangesMessage')"
    :confirm-label="t('tabs.discard')"
    @confirm="confirmClose"
    @cancel="pendingClosePath = null"
  />
</template>
