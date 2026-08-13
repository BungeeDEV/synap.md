<script setup lang="ts">
import type { ContextMenuItem } from '../contextMenuTypes';
import { isSubmenuItem } from '../contextMenuTypes';
import { ChevronRight } from '@lucide/vue';

const props = defineProps<{
  item: ContextMenuItem;
  selected?: boolean;
}>();

const emit = defineEmits<{
  (e: 'select'): void;
  (e: 'hover'): void;
}>();
</script>

<template>
  <div 
    class="flex items-center gap-2.5 px-3 py-1.5 text-[13px] rounded-md transition-colors select-none"
    :class="[
      item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      item.danger ? 'text-red-500' : 'text-content-primary',
      selected && !item.disabled ? 'bg-surface-2' : 'hover:bg-surface-2'
    ]"
    @click.stop="!item.disabled && emit('select')"
    @mouseenter="!item.disabled && emit('hover')"
  >
    <!-- Icon Placeholder or Component -->
    <div class="w-4 h-4 shrink-0 flex items-center justify-center text-content-tertiary">
      <component v-if="item.icon" :is="item.icon" class="w-4 h-4" stroke-width="1.5" :class="item.danger ? 'text-red-500' : ''" />
    </div>
    
    <span class="flex-1 truncate">{{ item.label }}</span>
    
    <ChevronRight v-if="isSubmenuItem(item)" class="w-3.5 h-3.5 text-content-tertiary shrink-0" stroke-width="2" />
  </div>
</template>
