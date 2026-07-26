<script setup lang="ts">
import { Folder, List } from 'lucide-vue-next'

const sidebarPanel = useSidebarPanelStore()
</script>

<template>
  <div class="flex touch-manipulation select-none items-center gap-1">
    <button
      type="button"
      class="rounded-full p-3 transition-colors duration-150 md:p-2"
      :class="sidebarPanel.activePanel === 'explorer' ? 'bg-accent text-white' : 'text-content-tertiary hover:text-content-secondary'"
      title="Explorer"
      @click="sidebarPanel.setPanel('explorer')"
    >
      <Folder class="h-5 w-5" stroke-width="1.5" :fill="sidebarPanel.activePanel === 'explorer' ? 'currentColor' : 'none'" />
    </button>
    <button
      type="button"
      class="rounded-full p-3 transition-colors duration-150 md:p-2"
      :class="sidebarPanel.activePanel === 'outline' ? 'bg-accent text-white' : 'text-content-tertiary hover:text-content-secondary'"
      title="Outline"
      @click="sidebarPanel.setPanel('outline')"
    >
      <List class="h-5 w-5" stroke-width="1.5" :fill="sidebarPanel.activePanel === 'outline' ? 'currentColor' : 'none'" />
    </button>
  </div>
</template>
