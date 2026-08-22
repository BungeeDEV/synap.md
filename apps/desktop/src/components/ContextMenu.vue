<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { appState } from '../store';
import type { ContextMenuGroup, ContextMenuItem } from '../contextMenuTypes';
import { isSubmenuItem } from '../contextMenuTypes';
import ContextMenuItemComp from './ContextMenuItem.vue';

const props = defineProps<{
  groups: ContextMenuGroup[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const menuRef = ref<HTMLElement | null>(null);
const activeSubmenuId = ref<string | null>(null);
const selectedIndex = ref(-1);

// Flatten items for keyboard navigation
const flatItems = computed(() => {
  const items: { item: ContextMenuItem; groupIndex: number; itemIndex: number }[] = [];
  props.groups.forEach((group, gIdx) => {
    group.forEach((item, iIdx) => {
      items.push({ item, groupIndex: gIdx, itemIndex: iIdx });
    });
  });
  return items;
});

function handleKeydown(e: KeyboardEvent) {
  if (!appState.contextMenu) return;

  const validItems = flatItems.value;
  if (validItems.length === 0) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    if (activeSubmenuId.value) {
      activeSubmenuId.value = null; // Close submenu first
    } else {
      emit('close');
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    do {
      selectedIndex.value = (selectedIndex.value + 1) % validItems.length;
    } while (validItems[selectedIndex.value].item.disabled);
    activeSubmenuId.value = null;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    do {
      selectedIndex.value = (selectedIndex.value - 1 + validItems.length) % validItems.length;
    } while (validItems[selectedIndex.value].item.disabled);
    activeSubmenuId.value = null;
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (selectedIndex.value >= 0 && selectedIndex.value < validItems.length) {
      const selectedItem = validItems[selectedIndex.value].item;
      if (!selectedItem.disabled) {
        if (isSubmenuItem(selectedItem)) {
          activeSubmenuId.value = selectedItem.id;
        } else {
          selectedItem.onSelect();
          emit('close');
        }
      }
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

// Positioning Logic
const posX = ref(0);
const posY = ref(0);

watch(() => appState.contextMenu, async (ctx) => {
  if (ctx) {
    posX.value = ctx.x;
    posY.value = ctx.y;
    selectedIndex.value = -1;
    activeSubmenuId.value = ctx.initialSubmenu || null;
    
    await nextTick();
    if (menuRef.value) {
      const rect = menuRef.value.getBoundingClientRect();
      const padding = 8;
      
      // Clamp X
      if (rect.right > window.innerWidth - padding) {
        posX.value = window.innerWidth - rect.width - padding;
      }
      
      // Clamp Y
      if (rect.bottom > window.innerHeight - padding) {
        posY.value = window.innerHeight - rect.height - padding;
      }
    }
  }
}, { immediate: true });

function handleItemSelect(item: ContextMenuItem) {
  if (item.disabled) return;
  if (isSubmenuItem(item)) {
    activeSubmenuId.value = activeSubmenuId.value === item.id ? null : item.id;
  } else {
    item.onSelect();
    emit('close');
  }
}

function handleItemHover(item: ContextMenuItem, globalIndex: number) {
  if (!item.disabled) {
    selectedIndex.value = globalIndex;
    if (isSubmenuItem(item)) {
      activeSubmenuId.value = item.id;
    } else {
      activeSubmenuId.value = null;
    }
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="appState.contextMenu" class="fixed inset-0 z-[100]" @contextmenu.prevent="emit('close')">
      <!-- Overlay to catch clicks outside -->
      <div class="absolute inset-0" @click="emit('close')"></div>
      
      <!-- Menu Panel -->
      <div 
        ref="menuRef"
        class="absolute bg-surface-1/95 backdrop-blur-md border border-border shadow-float rounded-lg py-1.5 w-64 flex flex-col"
        :style="{ top: `${posY}px`, left: `${posX}px` }"
      >
        <template v-for="(group, gIdx) in groups" :key="gIdx">
          <div v-if="gIdx > 0" class="h-px bg-border my-1.5 mx-2"></div>
          
          <div class="px-1.5 flex flex-col gap-0.5">
            <template v-for="(item, iIdx) in group" :key="item.id">
              <div class="relative">
                <ContextMenuItemComp 
                  :item="item" 
                  :selected="selectedIndex === flatItems.findIndex(f => f.item.id === item.id)"
                  @select="handleItemSelect(item)"
                  @hover="handleItemHover(item, flatItems.findIndex(f => f.item.id === item.id))"
                />
                
                <!-- Submenu Render -->
                <div 
                  v-if="isSubmenuItem(item) && activeSubmenuId === item.id"
                  class="absolute top-0 left-full ml-1"
                >
                  <slot :name="item.submenu" :close="() => emit('close')"></slot>
                </div>
              </div>
            </template>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
