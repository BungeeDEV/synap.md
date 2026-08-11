<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { Folder } from 'lucide-vue-next';

import { appState, rebuildFileTree, resetAppState } from './store';
import VaultSidebar from './components/VaultSidebar.vue';
import EditorWorkspace from './components/EditorWorkspace.vue';
import SettingsModal from './components/SettingsModal.vue';
import CommandPalette from './components/CommandPalette.vue';

onMounted(async () => {
    const store = await load('store.json', { autoSave: false });
    const storedPath = await store.get<string>('vaultPath');
    const storedUrl = await store.get<string>('serverUrl');
    const storedToken = await store.get<string>('token');

    if (storedUrl) appState.serverUrl = storedUrl;
    if (storedToken) appState.token = storedToken;
    if (await store.has('isAutoSyncEnabled')) {
        appState.isAutoSyncEnabled = await store.get<boolean>('isAutoSyncEnabled') ?? true;
    }
    
    // Load Editor Settings
    if (await store.has('defaultView')) appState.defaultView = await store.get<any>('defaultView') ?? 'editor';
    if (await store.has('editorFontSize')) appState.editorFontSize = await store.get<number>('editorFontSize') ?? 16;
    if (await store.has('editorFontFamily')) appState.editorFontFamily = await store.get<any>('editorFontFamily') ?? 'sans';
    if (await store.has('editorLineHeight')) appState.editorLineHeight = await store.get<number>('editorLineHeight') ?? 1.7;

    // Watch for editor setting changes to auto-save
    watch(() => [
        appState.defaultView, 
        appState.editorFontSize, 
        appState.editorFontFamily, 
        appState.editorLineHeight
    ], async () => {
        const store = await load('store.json', { autoSave: false });
        await store.set('defaultView', appState.defaultView);
        await store.set('editorFontSize', appState.editorFontSize);
        await store.set('editorFontFamily', appState.editorFontFamily);
        await store.set('editorLineHeight', appState.editorLineHeight);
        await store.save();
    }, { deep: true });

    if (storedPath) {
        appState.vaultPath = storedPath;
        await startApp(storedPath);
    }
    
    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

        // Cmd+K / Cmd+F => Search / Command Palette
        if (cmdOrCtrl && (e.key === 'k' || e.key === 'f')) {
            e.preventDefault();
            appState.isSearchOpen = true;
        }
        
        // Cmd+\ or Cmd+B => Toggle Sidebar
        if (cmdOrCtrl && (e.key === '\\' || e.key === 'b')) {
            e.preventDefault();
            appState.isSidebarOpen = !appState.isSidebarOpen;
        }

        // Cmd+N or Cmd+Alt+N => New Note
        if (cmdOrCtrl && (e.key === 'n' || (e.altKey && e.key === 'n'))) {
            e.preventDefault();
            createNewNote();
        }

        // Cmd+S => Global Save Pulse
        if (cmdOrCtrl && e.key === 's') {
            e.preventDefault();
            if (appState.activeFile) {
                appState.justSaved = true;
                setTimeout(() => appState.justSaved = false, 1000);
            }
        }

        // Escape => Close modals
        if (e.key === 'Escape') {
            if (appState.isSettingsOpen) {
                e.preventDefault();
                appState.isSettingsOpen = false;
            } else if (appState.isSearchOpen) {
                e.preventDefault();
                appState.isSearchOpen = false;
            }
        }
    });
});

async function createNewNote() {
    if (!appState.vaultPath) return;
    try {
        let i = 1;
        let newName = `Unbenannt.md`;
        while (appState.localFiles.find(f => f.name === newName)) {
            newName = `Unbenannt ${i}.md`;
            i++;
        }
        const fullPath = `${appState.vaultPath}/${newName}`;
        await writeTextFile(fullPath, '# Neue Notiz\n\n');
        await refreshLocalFiles();
        await loadFile(newName);
    } catch (e) {
        console.error("Failed to create new note", e);
    }
}

async function selectVaultFolder() {
    const selected = await open({ directory: true, multiple: false });
    if (selected && !Array.isArray(selected)) {
        const store = await load('store.json', { autoSave: false });
        await store.set('vaultPath', selected);
        await store.save();
        appState.vaultPath = selected;
        await startApp(selected);
    }
}

async function startApp(path: string) {
    try {
        await invoke('init_db', { vaultPath: path });
        if (appState.serverUrl && appState.token) {
            if (appState.isAutoSyncEnabled) {
                await invoke('start_background_sync', { url: appState.serverUrl, token: appState.token });
            }
        }
        await refreshLocalFiles();
        appState.statusMsg = "Vault & Auto-Sync aktiv.";

        await listen('sync-done', () => refreshLocalFiles());
    } catch (e: any) {
        appState.statusMsg = `App Error: ${e}`;
    }
}

async function refreshLocalFiles() {
    try {
        appState.localFiles = await invoke<any[]>('get_local_files');
        rebuildFileTree();
    } catch (e: any) {
        appState.statusMsg = `Error loading files: ${e}`;
    }
}

async function manualSync() {
    appState.statusMsg = "Syncing with server...";
    try {
        const store = await load('store.json', { autoSave: false });
        await store.set('serverUrl', appState.serverUrl);
        await store.set('token', appState.token);
        await store.save();

        if (appState.isAutoSyncEnabled) {
            await invoke('start_background_sync', { url: appState.serverUrl, token: appState.token });
        }
        await invoke('sync_now', { url: appState.serverUrl, token: appState.token });
        await refreshLocalFiles();
        appState.statusMsg = "Synced.";
    } catch (e: any) {
        appState.statusMsg = `Error: ${e}`;
    }
}

async function toggleAutoSync() {
    try {
        const store = await load('store.json', { autoSave: false });
        await store.set('isAutoSyncEnabled', appState.isAutoSyncEnabled);
        await store.save();
        
        if (appState.isAutoSyncEnabled && appState.serverUrl && appState.token) {
            await invoke('start_background_sync', { url: appState.serverUrl, token: appState.token });
        } else {
            await invoke('stop_background_sync');
        }
    } catch (e) {
        console.error("Failed to toggle auto sync", e);
    }
}

async function changeVault() {
    await selectVaultFolder();
    appState.isSettingsOpen = false;
}

async function resetApp() {
    if (!confirm("Bist du sicher? Alle lokalen Einstellungen und Verbindungsdaten werden gelöscht (deine Notizen bleiben auf der Festplatte).")) {
        return;
    }
    
    try {
        // Stop sync and delete db
        await invoke('wipe_sync_db');
        
        // Clear Tauri store
        const store = await load('store.json', { autoSave: false });
        await store.clear();
        await store.save();
        
        // Clear global state
        resetAppState();
    } catch (e: any) {
        console.error("Failed to wipe app:", e);
        alert(`Fehler beim Zurücksetzen: ${e}`);
    }
}

async function loadFile(path: string) {
    if (!appState.vaultPath) return;
    try {
        const fullPath = `${appState.vaultPath}/${path}`;
        const content = await readTextFile(fullPath);
        appState.lastLoadedContent = content;
        appState.activeContent = content;
        appState.activeFile = path;
        appState.isReaderMode = appState.defaultView === 'reader';
        
        // Add to tabs if not present
        if (!appState.tabs.includes(path)) {
            appState.tabs.push(path);
        }
    } catch (e: any) {
        appState.statusMsg = `Load error: ${e}`;
    }
}

let saveTimeout: any = null;
watch(() => appState.activeContent, async (newVal) => {
    if (!appState.activeFile || !appState.vaultPath) return;
    if (newVal === appState.lastLoadedContent) return; 
    
    appState.lastLoadedContent = newVal;

    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            const fullPath = `${appState.vaultPath}/${appState.activeFile}`;
            await writeTextFile(fullPath, newVal);
            appState.statusMsg = `Gespeichert`;
            appState.justSaved = true;
            setTimeout(() => appState.justSaved = false, 500);
        } catch (e: any) {
            appState.statusMsg = `Fehler: ${e}`;
        }
    }, 500);
});
</script>

<template>
  <!-- Root: fixed to viewport, no overflow, flex column -->
  <div class="h-app w-screen flex flex-col overflow-hidden bg-base font-sans text-content-primary">
    
    <!-- Setup Screen -->
    <div v-if="!appState.vaultPath" class="flex-1 flex flex-col items-center justify-center gap-4 p-8">
      <Folder class="w-12 h-12 text-content-tertiary mb-2" stroke-width="1.5" />
      <h2 class="text-2xl font-bold text-content-primary tracking-tight">Synap Vault wählen</h2>
      <p class="text-content-secondary mb-4 text-center max-w-sm">Wähle den lokalen Ordner für deine Offline-Notizen aus.</p>
      <button @click="selectVaultFolder" class="btn-primary">
        <Folder class="w-4 h-4" stroke-width="1.5" /> Ordner auswählen...
      </button>
    </div>

    <!-- Main App Layout: horizontal flex, fills remaining height -->
    <div v-else class="flex flex-1 min-h-0 overflow-hidden">
      <!-- Modular Sidebar (fixed 256px, internal flex-col) -->
      <VaultSidebar v-if="appState.isSidebarOpen" @select="loadFile" @new-note="createNewNote" />

      <!-- Modular Workspace (flex-1, fills rest) -->
      <EditorWorkspace v-model="appState.activeContent" />
    </div>

    <!-- Modals (fixed overlays, unaffected by layout) -->
    <SettingsModal @sync="manualSync" @change-vault="changeVault" @reset-app="resetApp" @toggle-auto-sync="toggleAutoSync" />
    <CommandPalette @select="loadFile" />
  </div>
</template>
