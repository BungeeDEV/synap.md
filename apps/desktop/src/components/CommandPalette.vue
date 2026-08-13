<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { appState } from '../store';
import { Search, FileText, CornerDownLeft } from '@lucide/vue';

const emit = defineEmits<{
  (e: 'select', path: string): void
}>();

const searchQuery = ref('');
const selectedIndex = ref(0);
const searchInput = ref<HTMLInputElement | null>(null);

const filteredFiles = computed(() => {
  if (!searchQuery.value) return appState.localFiles.filter(f => !f.isDir).slice(0, 10);
  const q = searchQuery.value.toLowerCase();
  return appState.localFiles
    .filter(f => !f.isDir && f.name.toLowerCase().includes(q))
    .slice(0, 20);
});

watch(searchQuery, () => {
  selectedIndex.value = 0;
});

watch(() => appState.isSearchOpen, async (isOpen) => {
  if (isOpen) {
    searchQuery.value = '';
    selectedIndex.value = 0;
    await nextTick();
    searchInput.value?.focus();
  }
});

function handleKeydown(e: KeyboardEvent) {
  if (!appState.isSearchOpen) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIndex.value = (selectedIndex.value + 1) % filteredFiles.value.length;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIndex.value = (selectedIndex.value - 1 + filteredFiles.value.length) % filteredFiles.value.length;
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (filteredFiles.value.length > 0) {
      selectFile(filteredFiles.value[selectedIndex.value].path);
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    appState.isSearchOpen = false;
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

function selectFile(path: string) {
  appState.isSearchOpen = false;
  emit('select', path);
}
</script>

<template>
  <div v-if="appState.isSearchOpen" class="modal-backdrop z-[60] items-start pt-[15vh]">
    <div class="absolute inset-0" @click="appState.isSearchOpen = false"></div>
    
    <div class="modal-panel relative z-10 w-full max-w-[600px] flex flex-col overflow-hidden bg-surface-1 shadow-2xl border border-divider p-0 rounded-xl">
      <!-- Search Input -->
      <div class="flex items-center px-4 py-3 border-b border-divider gap-3 bg-surface-1">
        <Search class="w-5 h-5 text-content-tertiary" stroke-width="1.5" />
        <input 
          ref="searchInput"
          v-model="searchQuery"
          class="flex-1 bg-transparent text-[15px] text-content-primary focus:outline-none placeholder:text-content-tertiary"
          placeholder="Notiz suchen..."
        />
        <div class="text-[11px] font-mono text-content-tertiary bg-surface-2 px-1.5 py-0.5 rounded border border-divider">ESC</div>
      </div>

      <!-- Results List -->
      <div class="max-h-[350px] overflow-y-auto p-2 flex flex-col gap-1">
        <template v-if="filteredFiles.length > 0">
          <div 
            v-for="(file, index) in filteredFiles" 
            :key="file.path"
            @click="selectFile(file.path)"
            @mouseenter="selectedIndex = index"
            :class="[
              'flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-[14px]',
              index === selectedIndex ? 'bg-accent/10 text-accent' : 'text-content-secondary hover:bg-surface-2 hover:text-content-primary'
            ]"
          >
            <div class="flex items-center gap-3 truncate">
              <FileText class="w-4 h-4 opacity-50 shrink-0" stroke-width="2" />
              <span class="truncate">{{ file.name.replace(/\.md$/i, '') }}</span>
            </div>
            
            <div v-if="index === selectedIndex" class="shrink-0 flex items-center text-accent/50 gap-1">
              <span class="text-[10px] uppercase font-semibold tracking-wider">Öffnen</span>
              <CornerDownLeft class="w-3.5 h-3.5" stroke-width="2" />
            </div>
          </div>
        </template>
        <template v-else>
          <div class="px-4 py-8 text-center text-content-tertiary text-[13px]">
            Keine Notizen gefunden.
          </div>
        </template>
      </div>
      
      <!-- Footer Info -->
      <div class="px-4 py-2 border-t border-divider bg-surface-2 flex items-center gap-4 text-[11px] text-content-tertiary">
        <span class="flex items-center gap-1"><span class="font-mono bg-surface-1 px-1 rounded border border-divider">↑</span> <span class="font-mono bg-surface-1 px-1 rounded border border-divider">↓</span> Navigieren</span>
        <span class="flex items-center gap-1"><span class="font-mono bg-surface-1 px-1 rounded border border-divider">↵</span> Auswählen</span>
      </div>
    </div>
  </div>
</template>
