<script setup lang="ts">
import { ref, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { readDir, remove } from '@tauri-apps/plugin-fs';
import { AlertTriangle, Trash2, X, Folder, ShieldAlert } from '@lucide/vue';
import { appState, rebuildFileTree } from '../store';

const emit = defineEmits<{
  (e: 'deleted'): void
}>();

const isChecking = ref(false);
const containsFiles = ref(false);
const itemCount = ref(0);
const isRecursiveChecked = ref(false);
const isDeleting = ref(false);
const errorMessage = ref('');

watch(() => appState.folderToDelete, async (node) => {
  if (node && appState.vaultPath) {
    // Reset state
    containsFiles.value = false;
    itemCount.value = 0;
    isRecursiveChecked.value = false;
    isDeleting.value = false;
    errorMessage.value = '';
    isChecking.value = true;
    
    try {
      const fullPath = `${appState.vaultPath}/${node.path}`;
      const entries = await readDir(fullPath);
      
      // Filter out hidden system files if needed, or just count all
      const visibleEntries = entries.filter(e => !e.name.startsWith('.'));
      
      if (visibleEntries.length > 0) {
        containsFiles.value = true;
        itemCount.value = visibleEntries.length;
      }
    } catch (e: any) {
      console.error("Failed to read directory", e);
      // Assume it has files to be safe if read fails
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
  if (containsFiles.value && !isRecursiveChecked.value) return; // Safeguard
  
  isDeleting.value = true;
  errorMessage.value = '';
  
  try {
    const fullPath = `${appState.vaultPath}/${appState.folderToDelete.path}`;
    await remove(fullPath, { recursive: isRecursiveChecked.value || containsFiles.value });
    
    // Refresh global state
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
  <div v-if="appState.folderToDelete" class="modal-backdrop z-[200]">
    <div class="absolute inset-0" @click="close"></div>
    
    <div class="modal-panel relative z-10 w-full max-w-[480px] p-0 flex flex-col overflow-hidden animate-fade-in shadow-2xl">
      <!-- Header -->
      <div class="px-5 py-4 border-b border-divider flex items-center justify-between bg-surface-2">
        <h2 class="text-[15px] font-semibold text-content-primary flex items-center gap-2">
          <Trash2 class="w-4 h-4 text-danger-DEFAULT" /> Ordner löschen
        </h2>
        <button @click="close" class="p-1 text-content-tertiary hover:text-content-primary transition-colors rounded-md hover:bg-surface-1">
          <X class="w-4 h-4" stroke-width="2" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 flex flex-col gap-5 bg-surface-1">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full bg-surface-2 border border-divider flex items-center justify-center shrink-0">
            <Folder class="w-5 h-5 text-content-secondary" stroke-width="1.5" />
          </div>
          <div>
            <p class="text-[14px] text-content-primary mb-1">
              Möchtest du den Ordner <span class="font-semibold break-all">'{{ appState.folderToDelete.name }}'</span> wirklich löschen?
            </p>
            <p class="text-[13px] text-content-tertiary">
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
          </div>
        </div>

        <div v-if="isChecking" class="text-[13px] text-content-tertiary flex items-center gap-2 px-2">
          <div class="w-3 h-3 border-2 border-content-tertiary border-t-transparent rounded-full animate-spin"></div>
          Prüfe Ordnerinhalt...
        </div>

        <template v-else>
          <!-- Warning if folder is not empty -->
          <div v-if="containsFiles" class="callout callout-danger mt-2 !my-0">
            <div class="flex gap-3">
              <ShieldAlert class="w-5 h-5 text-danger-DEFAULT shrink-0 mt-0.5" />
              <div class="flex flex-col gap-2">
                <p class="text-[13px] text-danger-DEFAULT font-medium">Achtung: Der Ordner ist nicht leer!</p>
                <p class="text-[13px] text-danger-DEFAULT/80">
                  Dieser Ordner enthält mindestens {{ itemCount }} Element(e). Wenn du ihn löschst, gehen alle darin enthaltenen Unterordner und Notizen dauerhaft verloren.
                </p>
              </div>
            </div>
          </div>

          <div v-else class="bg-surface-2 p-3 rounded-md border border-divider">
            <p class="text-[13px] text-content-secondary flex items-center gap-2">
              <Folder class="w-4 h-4" /> Der Ordner ist leer und kann sicher gelöscht werden.
            </p>
          </div>

          <!-- Recursive Checkbox -->
          <label v-if="containsFiles" class="synamp-checkbox !mb-0 mt-2 p-3 rounded-md border border-danger-strong/30 bg-danger-DEFAULT/5 hover:bg-danger-DEFAULT/10 transition-colors">
            <input type="checkbox" v-model="isRecursiveChecked" />
            <span class="text-[13px] font-medium text-danger-DEFAULT">Ordner rekursiv löschen (inklusive aller Inhalte)</span>
          </label>
        </template>

        <p v-if="errorMessage" class="text-[13px] text-danger-DEFAULT mt-2">{{ errorMessage }}</p>
      </div>

      <!-- Footer -->
      <div class="px-5 py-4 border-t border-divider bg-surface-2 flex items-center justify-end gap-3">
        <button @click="close" class="btn-secondary text-[13px]" :disabled="isDeleting">
          Abbrechen
        </button>
        <button 
          @click="confirmDelete" 
          class="btn-primary bg-danger-DEFAULT hover:bg-danger-strong text-white border-none text-[13px] min-w-[100px] justify-center"
          :class="{ 'opacity-50 cursor-not-allowed': containsFiles && !isRecursiveChecked }"
          :disabled="(containsFiles && !isRecursiveChecked) || isDeleting"
        >
          {{ isDeleting ? 'Lösche...' : 'Ordner löschen' }}
        </button>
      </div>
    </div>
  </div>
</template>
