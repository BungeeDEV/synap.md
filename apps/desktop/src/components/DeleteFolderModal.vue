<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { readDir, remove } from '@tauri-apps/plugin-fs';
import { Trash2, FolderOpen, AlertCircle, X } from '@lucide/vue';
import { appState, rebuildFileTree } from '../store';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const emit = defineEmits<{
  (e: 'deleted'): void
}>();

const isChecking = ref(false);
const containsFiles = ref(false);
const itemCount = ref(0);
const isRecursiveChecked = ref(false);
const isDeleting = ref(false);
const errorMessage = ref('');

const targetNode = computed(() => appState.folderToDelete);
const confirmRecursive = ref(false);

watch(() => appState.folderToDelete, async (node) => {
  if (node && appState.vaultPath) {
    containsFiles.value = false;
    itemCount.value = 0;
    isRecursiveChecked.value = false;
    confirmRecursive.value = false;
    isDeleting.value = false;
    errorMessage.value = '';
    isChecking.value = true;
    
    try {
      const fullPath = `${appState.vaultPath}/${node.path}`;
      const entries = await readDir(fullPath);
      
      const visibleEntries = entries.filter(e => !e.name.startsWith('.'));
      
      if (visibleEntries.length > 0) {
        containsFiles.value = true;
        itemCount.value = visibleEntries.length;
      }
    } catch (e: any) {
      console.error("Failed to read directory", e);
      containsFiles.value = true; 
    } finally {
      isChecking.value = false;
    }
  }
});

function close() {
  appState.folderToDelete = null;
}

async function confirmDelete() {
  if (!appState.folderToDelete || !appState.vaultPath) return;
  if (containsFiles.value && !confirmRecursive.value) return; 
  
  isDeleting.value = true;
  errorMessage.value = '';
  
  try {
    const fullPath = `${appState.vaultPath}/${appState.folderToDelete.path}`;
    await remove(fullPath, { recursive: confirmRecursive.value || containsFiles.value });
    
    appState.localFiles = await invoke<any[]>('get_local_files');
    rebuildFileTree();
    
    emit('deleted');
    close();
  } catch (e: any) {
    errorMessage.value = `Fehler beim Löschen: ${e}`;
    isDeleting.value = false;
  }
}
</script>

<template>
  <div v-if="targetNode" class="modal-backdrop z-[200]">
    <div class="absolute inset-0" @click="close"></div>
    
    <div class="modal-panel relative z-10 w-full max-w-[480px] p-0 flex flex-col overflow-hidden animate-fade-in shadow-2xl">
      <!-- Header -->
      <div class="px-5 py-4 border-b border-divider flex items-center justify-between bg-surface-2">
        <h2 class="text-sm font-semibold text-content-primary flex items-center gap-2">
          <Trash2 class="w-4 h-4 text-danger-DEFAULT" /> {{ t('dialogs.deleteFolder') }}
        </h2>
        <button @click="close" class="p-1 text-content-tertiary hover:text-content-primary transition-colors rounded-md hover:bg-surface-1">
          <X class="w-4 h-4" stroke-width="2" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 flex flex-col gap-5 bg-surface-1">
        <div class="p-4 bg-base border-t border-b border-divider">
          <p class="text-[13px] text-content-primary mb-3">
            {{ t('dialogs.deleteFolderConfirm', { name: targetNode.name }) }}
          </p>
          <p class="text-[13px] text-content-tertiary">
            Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
        </div>

        <div v-if="isChecking" class="text-[13px] text-content-tertiary flex items-center gap-2 px-2">
          <div class="w-3 h-3 border-2 border-content-tertiary border-t-transparent rounded-full animate-spin"></div>
          Prüfe Ordnerinhalt...
        </div>

        <template v-else>
          <!-- Warning if folder is not empty -->
          <div v-if="containsFiles" class="mt-2 !my-0">
            <div class="flex items-start gap-2 text-danger-DEFAULT mb-2">
              <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
              <div class="text-[13px] font-medium">{{ t('dialogs.deleteFolderWarning') }}</div>
            </div>
            <p class="text-xs text-danger-DEFAULT/80 mb-3">
              {{ t('dialogs.deleteFolderDesc') }}
            </p>
            
            <label class="flex items-start gap-2 cursor-pointer bg-white/5 p-2 rounded border border-danger-strong/20 hover:bg-white/10 transition-colors">
              <input type="checkbox" v-model="confirmRecursive" class="mt-0.5" />
              <span class="text-xs text-danger-DEFAULT font-medium">{{ t('dialogs.deleteFolderRecursive') }}</span>
            </label>
          </div>

          <div v-else class="bg-success/10 text-success border border-success/20 p-3 rounded-md flex items-center gap-2">
            <FolderOpen class="w-4 h-4 shrink-0" />
            <span class="text-[13px]">{{ t('dialogs.deleteFolderEmpty') }}</span>
          </div>
        </template>

        <p v-if="errorMessage" class="text-[13px] text-danger-DEFAULT mt-2">{{ errorMessage }}</p>
      </div>

      <!-- Footer -->
      <div class="px-5 py-4 border-t border-divider bg-surface-2 flex items-center justify-end gap-3">
        <button @click="close" class="btn-secondary text-[13px]" :disabled="isDeleting">
          {{ t('dialogs.cancel') }}
        </button>
        <button 
          @click="confirmDelete" 
          class="btn-primary bg-danger-DEFAULT hover:bg-danger-strong text-white border-none text-[13px]"
          :disabled="(containsFiles && !confirmRecursive) || isDeleting"
          :class="{'opacity-50 cursor-not-allowed': (containsFiles && !confirmRecursive) || isDeleting}"
        >
          {{ isDeleting ? t('common.loading') : t('dialogs.deleteFolder') }}
        </button>
      </div>
    </div>
  </div>
</template>
