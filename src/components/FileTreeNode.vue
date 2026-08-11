<script setup lang="ts">
import { appState, toggleFolder, TreeNode } from '../store';
import { ChevronRight, ChevronDown, FileText } from 'lucide-vue-next';

const props = defineProps<{
  nodes: TreeNode[];
}>();

const emit = defineEmits<{
  (e: 'select', path: string): void
}>();

function handleClick(node: TreeNode) {
  if (node.isDir) {
    toggleFolder(node.path);
  } else {
    emit('select', node.path);
  }
}
</script>

<template>
  <div class="flex flex-col w-full">
    <div v-for="node in nodes" :key="node.path" class="w-full">
      <div 
        @click="handleClick(node)"
        :class="['sidebar-row group text-[15px] py-1.5 px-2 select-none', !node.isDir && appState.activeFile === node.path ? 'active' : '']"
        :style="{ paddingLeft: '8px' }"
      >
        <div class="flex items-center gap-2 truncate w-full">
          <!-- Icon -->
          <div class="w-5 h-5 shrink-0 flex items-center justify-center text-content-tertiary">
            <template v-if="node.isDir">
              <ChevronDown v-if="node.isOpen" class="w-4 h-4" stroke-width="2" />
              <ChevronRight v-else class="w-4 h-4" stroke-width="2" />
            </template>
            <template v-else>
              <FileText class="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" :class="appState.activeFile === node.path ? 'text-accent opacity-100' : ''" stroke-width="2" />
            </template>
          </div>
          
          <span class="truncate">{{ node.name.replace(/\.md$/i, '') }}</span>
        </div>
        
        <!-- Status Indicator -->
        <span v-if="!node.isDir && node.status" class="text-[9px] font-mono text-content-tertiary bg-base px-1 rounded opacity-0 group-hover:opacity-100 shrink-0">
          {{ node.status === 'Synced' ? '✓' : '●' }}
        </span>
      </div>
      
      <!-- Recursive Children (only rendered when folder is open) -->
      <div 
        v-if="node.isDir && node.isOpen" 
        class="ml-3 border-l"
      >
        <FileTreeNode :nodes="node.children" @select="$emit('select', $event)" />
      </div>
    </div>
  </div>
</template>
