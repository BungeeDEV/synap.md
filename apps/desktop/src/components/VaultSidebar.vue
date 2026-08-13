<script setup lang="ts">
import { computed } from 'vue';
import { appState, fileTree } from '../store';
import FileTreeNode from './FileTreeNode.vue';
import { 
  Settings, Search, Plus, FolderPlus, ArrowUpDown, ChevronDown,
  LayoutTemplate, Archive, Trash2 
} from '@lucide/vue';

const emit = defineEmits<{
  (e: 'select', path: string): void,
  (e: 'new-note'): void
}>();

const fileCount = computed(() => appState.localFiles.length);
const folderCount = computed(() => {
  const folders = new Set<string>();
  appState.localFiles.forEach(f => {
    const parts = f.path.split('/');
    if (parts.length > 1) {
      folders.add(parts.slice(0, -1).join('/'));
    }
  });
  return folders.size;
});
</script>

<template>
  <aside class="w-64 h-full border-r border-divider bg-surface-1 flex flex-col shrink-0 overflow-hidden">
    
    <!-- Workspace Header -->
    <div class="h-11 shrink-0 flex items-center justify-between px-3 border-b border-border">
      <div class="flex items-center gap-2 text-content-primary hover:bg-surface-2 px-2 py-1 rounded cursor-pointer transition-colors">
        <span class="font-semibold tracking-tight">synap</span>
        <ChevronDown class="w-3.5 h-3.5 text-content-tertiary" stroke-width="2" />
      </div>
      <div class="flex items-center gap-1 text-content-tertiary">
        <button @click="appState.isSearchOpen = true" class="p-1.5 hover:text-content-primary hover:bg-surface-2 rounded transition-colors" title="Suche (Cmd+K)">
          <Search class="w-4 h-4" stroke-width="1.5" />
        </button>
        <button @click="appState.isSettingsOpen = true" class="p-1.5 hover:text-content-primary hover:bg-surface-2 rounded transition-colors" title="Einstellungen">
          <Settings class="w-4 h-4" stroke-width="1.5" />
        </button>
      </div>
    </div>

    <!-- Action Bar -->
    <div class="px-3 py-3 flex items-center gap-1 shrink-0">
      <button @click="emit('new-note')" class="flex-1 btn-primary py-1.5 text-sm" title="Neue Notiz (Cmd+N)">
        <Plus class="w-4 h-4" stroke-width="2" />
        Neue Notiz
      </button>
      <button class="p-1.5 text-content-tertiary hover:text-content-primary hover:bg-surface-2 rounded-md transition-colors" title="Neuer Ordner">
        <FolderPlus class="w-4 h-4" stroke-width="1.5" />
      </button>
      <button class="p-1.5 text-content-tertiary hover:text-content-primary hover:bg-surface-2 rounded-md transition-colors" title="Sortieren">
        <ArrowUpDown class="w-4 h-4" stroke-width="1.5" />
      </button>
    </div>

    <!-- Scrollable Tree -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden p-2 flex flex-col gap-4">
      
      <!-- Main Tree -->
      <div>
        <FileTreeNode :nodes="fileTree" @select="$emit('select', $event)" />
      </div>

      <!-- Library Section -->
      <div>
        <h3 class="text-xs font-semibold text-content-tertiary uppercase tracking-[0.05em] mb-1 px-2">Bibliothek</h3>
        <div class="space-y-0.5">
          <div class="sidebar-row group text-[15px] py-2 px-2">
            <div class="flex items-center gap-2 truncate">
              <LayoutTemplate class="w-4 h-4 text-content-tertiary shrink-0" stroke-width="1.5" />
              <span>Vorlagen</span>
            </div>
          </div>
          <div class="sidebar-row group text-[15px] py-2 px-2">
            <div class="flex items-center gap-2 truncate">
              <Archive class="w-4 h-4 text-content-tertiary shrink-0" stroke-width="1.5" />
              <span>Archiv</span>
            </div>
          </div>
          <div class="sidebar-row group text-[15px] py-2 px-2">
            <div class="flex items-center gap-2 truncate">
              <Trash2 class="w-4 h-4 text-content-tertiary shrink-0" stroke-width="1.5" />
              <span>Papierkorb</span>
            </div>
          </div>
        </div>
      </div>
      
    </div>

    <!-- Stats Footer -->
    <div class="px-4 py-2 border-t border-border shrink-0">
      <p class="text-[11px] text-content-tertiary font-medium">
        {{ fileCount }} Dateien · {{ folderCount }} Ordner
      </p>
    </div>
  </aside>
</template>
