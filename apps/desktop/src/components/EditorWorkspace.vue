<script setup lang="ts">
import { computed } from 'vue';
import { appState } from '../store';
import { ChevronRight, FileText, PencilLine, Eye, X } from '@lucide/vue';
import NoteEditor from './NoteEditor.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void
}>();

// Simple Tab operations
function closeTab(path: string, e: Event) {
  e.stopPropagation();
  const index = appState.tabs.findIndex(tab => tab.path === path);
  if (index > -1) {
    appState.tabs.splice(index, 1);
    if (appState.activeFile === path) {
      const fallback = appState.tabs[index] ?? appState.tabs[index - 1];
      appState.activeFile = fallback?.path ?? null;
    }
  }
}

function selectTab(path: string) {
  appState.activeFile = path;
}

const breadcrumbs = computed(() => {
  if (!appState.activeFile) return [];
  const parts = appState.activeFile.split('/');
  return parts.map(p => p.replace(/\.md$/i, ''));
});

// Structured sync-status pill (replaces overloading statusMsg for sync
// state too): distinguishes syncing / error / N-files-pending / fully
// synced instead of one string that only ever shows the last message.
const syncStatusLabel = computed(() => {
  if (appState.syncStatus.state === 'syncing') return t('desktopApp.syncStateSyncing');
  if (appState.syncStatus.state === 'error') return t('desktopApp.syncStateError');
  if (appState.syncStatus.pendingCount > 0) return t('desktopApp.syncStatePending', { count: appState.syncStatus.pendingCount });
  return t('desktopApp.syncStateIdle');
});
const syncDotClass = computed(() => {
  if (appState.syncStatus.state === 'error') return 'bg-danger';
  if (appState.syncStatus.state === 'syncing') return 'bg-accent animate-pulse';
  if (appState.syncStatus.pendingCount > 0) return 'bg-content-tertiary';
  return 'bg-success';
});
</script>

<template>
  <main class="flex-1 min-w-0 h-full flex flex-col bg-base relative overflow-hidden">
    
    <!-- Tab Bar -->
    <div v-if="appState.tabs.length > 0" class="flex items-end h-9 shrink-0 bg-surface-1 px-2 overflow-x-auto gap-0.5">
      <div
        v-for="tab in appState.tabs"
        :key="tab.path"
        @click="selectTab(tab.path)"
        @auxclick="(e) => { if (e.button === 1) { e.preventDefault(); closeTab(tab.path, e); } }"
        @mousedown.middle.prevent
        :class="[
          'group flex items-center gap-2 h-[30px] px-3 rounded-t-md text-[13px] cursor-pointer max-w-[200px] shrink-0 transition-colors',
          appState.activeFile === tab.path
            ? 'bg-base text-content-primary'
            : 'text-content-tertiary hover:text-content-secondary hover:bg-[rgba(255,255,255,0.03)]'
        ]"
      >
        <span class="truncate">{{ tab.path.split('/').pop()?.replace(/\.md$/i, '') }}</span>
        <button
          @click="closeTab(tab.path, $event)"
          class="w-4 h-4 rounded-sm flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[rgba(255,255,255,0.08)] shrink-0 transition-opacity"
        >
          <X class="w-3 h-3" stroke-width="2" />
        </button>
      </div>
    </div>

    <!-- Header (Breadcrumb & Mode Toggle) -->
    <header class="h-10 shrink-0 flex items-center justify-between px-4 bg-base">
      
      <!-- Left: Breadcrumb -->
      <div v-if="appState.activeFile" class="breadcrumb">
        <span>synap</span>
        <ChevronRight class="w-3.5 h-3.5" stroke-width="1.5" />
        <template v-for="(segment, idx) in breadcrumbs" :key="idx">
          <ChevronRight v-if="idx > 0" class="w-3.5 h-3.5" stroke-width="1.5" />
          <span :class="['truncate', idx === breadcrumbs.length - 1 ? 'segment-last' : '']">{{ segment }}</span>
        </template>
      </div>
      <div v-else class="text-sm text-content-tertiary">{{ t('desktopApp.noFileSelected') }}</div>

      <!-- Right: View Mode Toggle (no border, accent bg for active) -->
      <div v-if="appState.activeFile" class="flex items-center gap-0.5 rounded-full p-0.5 bg-surface-2">
        <button
          @click="appState.isReaderMode = false"
          :class="['p-1.5 rounded-full transition-colors', !appState.isReaderMode ? 'bg-accent text-base' : 'text-content-tertiary hover:text-content-secondary']"
          :title="t('settings.modeEdit')"
        >
          <PencilLine class="w-3.5 h-3.5" stroke-width="2" />
        </button>
        <button
          @click="appState.isReaderMode = true"
          :class="['p-1.5 rounded-full transition-colors', appState.isReaderMode ? 'bg-accent text-base' : 'text-content-tertiary hover:text-content-secondary']"
          :title="t('settings.modeRead')"
        >
          <Eye class="w-3.5 h-3.5" stroke-width="2" />
        </button>
      </div>
    </header>
    
    <!-- Editor Canvas -->
    <div v-if="appState.activeFile" class="flex-1 min-h-0 flex flex-col relative">
       <!-- Currently NoteEditor covers both viewing (readonly) and editing via Tiptap. 
            For true "Reader Mode" we could pass a `readonly` flag to it or render Markdown. 
            For now, we just pass the mode to NoteEditor or let NoteEditor handle it. -->
       <NoteEditor 
         :modelValue="props.modelValue" 
         :isReaderMode="appState.isReaderMode"
         @update:modelValue="emit('update:modelValue', $event)" 
       />
    </div>
    
    <!-- Empty State -->
    <div v-else class="flex-1 p-8 flex flex-col items-center justify-center text-content-tertiary gap-3">
      <FileText class="w-10 h-10 opacity-30" stroke-width="1.5" />
      <p>{{ t('desktopApp.selectOrCreateNote') }}</p>
    </div>

    <!-- Floating Statusbar -->
    <div class="statusbar shadow-float z-50">
      <span v-if="appState.statusMsg" class="truncate max-w-[200px]">{{ appState.statusMsg }}</span>
      <span v-else>{{ t('desktopApp.ready') }}</span>
      <div class="w-px h-4 bg-divider-strong mx-1"></div>
      <div class="flex items-center gap-1.5">
        <div :class="['w-2 h-2 rounded-full shrink-0', syncDotClass]"></div>
        <span class="whitespace-nowrap">{{ syncStatusLabel }}</span>
      </div>
      <div class="w-px h-4 bg-divider-strong mx-1"></div>
      <div :class="['save-dot', appState.justSaved ? 'just-saved' : '']"></div>
    </div>
    
  </main>
</template>
