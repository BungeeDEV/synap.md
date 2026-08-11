<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'
import type { Component } from 'vue'
import { isSubmenuItem, type ContextMenuItem } from '~/utils/contextMenuTypes'

withDefaults(defineProps<{ item: ContextMenuItem, selected?: boolean, size?: 'compact' | 'comfortable' }>(), {
  selected: false,
  size: 'compact'
})
const emit = defineEmits<{ select: [], hover: [] }>()
</script>

<template>
  <div
    :id="item.id"
    role="menuitem"
    :aria-disabled="item.disabled ? 'true' : undefined"
    class="flex w-full cursor-pointer items-center gap-2.5 text-left transition-colors duration-150 focus-visible:outline-none"
    :class="[
      size === 'comfortable' ? 'min-h-12 px-4 py-3 text-base' : 'px-3.5 py-2',
      item.disabled ? 'cursor-not-allowed opacity-50' : '',
      item.danger ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-200',
      selected && !item.disabled ? 'bg-surface-2' : ''
    ]"
    @click="emit('select')"
    @mouseenter="emit('hover')"
  >
    <component :is="item.icon as Component" class="h-5 w-5 shrink-0" stroke-width="1.5" />
    <span class="flex-1 truncate">{{ item.label }}</span>
    <ChevronRight v-if="isSubmenuItem(item)" class="h-4 w-4 shrink-0" stroke-width="1.5" />
  </div>
</template>
