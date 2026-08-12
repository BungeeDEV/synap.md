<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { readTextFile, writeTextFile, remove, rename, mkdir, copyFile } from '@tauri-apps/plugin-fs';
import { 
  Folder, ExternalLink, Copy, FilePlus, FolderPlus, Download, 
  Trash2, Edit2, Star, Share, FolderOutput, Info, Palette, StickyNote
} from 'lucide-vue-next';

import { appState, rebuildFileTree, resetAppState } from './store';
import type { ContextMenuGroup } from './contextMenuTypes';
import VaultSidebar from './components/VaultSidebar.vue';
import EditorWorkspace from './components/EditorWorkspace.vue';
import SettingsModal from './components/SettingsModal.vue';
import CommandPalette from './components/CommandPalette.vue';
import ContextMenu from './components/ContextMenu.vue';

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

    // Ctrl + Scroll to zoom (change font size)
    window.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            if (e.deltaY < 0) {
                appState.editorFontSize = Math.min(appState.editorFontSize + 1, 48);
            } else if (e.deltaY > 0) {
                appState.editorFontSize = Math.max(appState.editorFontSize - 1, 10);
            }
            // Watcher on editorFontSize will automatically save it to store
        }
    }, { passive: false });
});

async function createNewNote(targetPath?: string) {
    if (!appState.vaultPath) return;
    try {
        let i = 1;
        const prefix = targetPath ? `${targetPath}/` : '';
        let newName = `${prefix}Unbenannt.md`;
        while (appState.localFiles.find(f => f.path === newName)) {
            newName = `${prefix}Unbenannt ${i}.md`;
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

// -- Context Menu Logic --
const contextMenuGroups = computed<ContextMenuGroup[]>(() => {
  if (!appState.contextMenu) return [];
  const node = appState.contextMenu.node;
  
  const handleRename = async () => {
    const newName = prompt('Neuer Name:', node.name);
    if (newName && newName !== node.name && appState.vaultPath) {
      const oldPath = `${appState.vaultPath}/${node.path}`;
      const newPathStr = node.path.substring(0, node.path.length - node.name.length) + newName + (node.isDir ? '' : (newName.endsWith('.md') ? '' : '.md'));
      const newFullPath = `${appState.vaultPath}/${newPathStr}`;
      try {
        await rename(oldPath, newFullPath);
        await refreshLocalFiles();
        if (appState.activeFile === node.path) {
          appState.activeFile = newPathStr;
        }
      } catch (e) { alert(`Fehler beim Umbenennen: ${e}`); }
    }
  };

  if (node.isDir) {
    return [
      [
        { id: 'new_note', label: 'Neue Note hier', icon: FilePlus, onSelect: () => createNewNote(node.path) },
        { id: 'new_folder', label: 'Neuer Unterordner', icon: FolderPlus, onSelect: async () => {
           if (!appState.vaultPath) return;
           const folderName = prompt('Name des Unterordners:');
           if (folderName) {
               try {
                   await mkdir(`${appState.vaultPath}/${node.path}/${folderName}`);
                   await refreshLocalFiles();
               } catch(e) { alert(`Fehler: ${e}`); }
           }
        }},
        { id: 'import', label: 'Dateien importieren…', icon: Download, onSelect: () => console.log('Import', node.path) },
        { id: 'favorite', label: 'Favorisieren', icon: Star, onSelect: () => console.log('Fav', node.path) },
      ],
      [
        { id: 'rename', label: 'Umbenennen', icon: Edit2, onSelect: handleRename },
        { id: 'move', label: 'Verschieben nach…', icon: FolderOutput, submenu: 'move' },
        { id: 'export_zip', label: 'Exportieren als ZIP', icon: Download, onSelect: () => console.log('Export ZIP', node.path) },
        { id: 'stats', label: 'Ordner-Statistik', icon: Info, onSelect: () => console.log('Stats', node.path) },
        { id: 'color', label: 'Farbe ändern', icon: Palette, submenu: 'color' },
      ],
      [
        { id: 'delete', label: 'Löschen', icon: Trash2, danger: true, onSelect: async () => {
           if (!confirm(`Möchtest du den Ordner '${node.name}' wirklich löschen?`)) return;
           if (appState.vaultPath) {
             const fp = `${appState.vaultPath}/${node.path}`;
             try {
               await remove(fp, { recursive: true });
               await refreshLocalFiles();
             } catch(e) { alert(`Fehler beim Löschen: ${e}`); }
           }
        }},
      ]
    ];
  } else {
    return [
      [
        { id: 'open_new', label: 'Öffnen in neuem Tab', icon: ExternalLink, onSelect: () => loadFile(node.path) },
        { id: 'sticky', label: 'Als Sticky Note öffnen', icon: StickyNote, onSelect: async () => {
             try {
                 await invoke('open_sticky', { path: node.path });
             } catch(e) { alert(`Fehler: ${e}`); }
        }},
        { id: 'rename', label: 'Umbenennen', icon: Edit2, onSelect: handleRename },
        { id: 'favorite', label: 'Favorisieren', icon: Star, onSelect: () => console.log('Fav', node.path) },
      ],
      [
        { id: 'duplicate', label: 'Duplizieren', icon: Copy, onSelect: async () => {
           if (!appState.vaultPath) return;
           const copyPath = node.path.replace(/\.md$/, ' (Kopie).md');
           try {
             await copyFile(`${appState.vaultPath}/${node.path}`, `${appState.vaultPath}/${copyPath}`);
             await refreshLocalFiles();
           } catch(e) { alert(`Fehler: ${e}`); }
        }},
        { id: 'move', label: 'Verschieben nach…', icon: FolderOutput, submenu: 'move' },
        { id: 'copy_link', label: 'Internen Link kopieren', icon: Copy, onSelect: async () => {
           try {
             await navigator.clipboard.writeText(`synap://${node.path}`);
             appState.statusMsg = "Link in die Zwischenablage kopiert!";
           } catch(e) { console.error(e); }
        }},
        { id: 'share', label: 'Externen Link teilen', icon: Share, onSelect: () => console.log('Share', node.path) },
        { id: 'export', label: 'Exportieren', icon: Download, submenu: 'export' },
        { id: 'details', label: 'Details anzeigen', icon: Info, onSelect: () => alert(`Datei: ${node.name}\nPfad: ${node.path}`) },
      ],
      [
        { id: 'archive', label: 'Archivieren', icon: FolderOutput, onSelect: () => console.log('Archive', node.path) },
        { id: 'delete', label: 'Löschen', icon: Trash2, danger: true, onSelect: async () => {
           if (!confirm(`Möchtest du die Datei '${node.name}' wirklich löschen?`)) return;
           if (appState.vaultPath) {
             const fp = `${appState.vaultPath}/${node.path}`;
             try {
               await remove(fp);
               await refreshLocalFiles();
               if (appState.activeFile === node.path) {
                 appState.activeFile = null;
                 appState.activeContent = '';
               }
             } catch(e) { alert(`Fehler beim Löschen: ${e}`); }
           }
        }},
      ]
    ];
  }
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
    
    <ContextMenu 
      v-if="appState.contextMenu"
      :groups="contextMenuGroups"
      @close="appState.contextMenu = null"
    >
      <template #move="{ close }">
        <div class="bg-surface-2 p-3 text-[13px] rounded shadow-md border border-divider w-48">
          <p class="font-semibold mb-2">Verschieben nach:</p>
          <p class="text-content-tertiary">Ziel wählen...</p>
          <button @click="close" class="mt-2 text-accent">Abbrechen</button>
        </div>
      </template>
      <template #export="{ close }">
        <div class="bg-surface-2 p-2 text-[13px] rounded shadow-md border border-divider flex flex-col gap-1 w-40">
          <button @click="close" class="text-left px-2 py-1.5 hover:bg-surface-1 rounded">Als Markdown</button>
          <button @click="close" class="text-left px-2 py-1.5 hover:bg-surface-1 rounded">Drucken (PDF)</button>
        </div>
      </template>
      <template #color="{ close }">
        <div class="bg-surface-2 p-3 text-[13px] rounded shadow-md border border-divider flex gap-2">
          <div @click="close" class="w-6 h-6 rounded-full bg-red-500 cursor-pointer"></div>
          <div @click="close" class="w-6 h-6 rounded-full bg-blue-500 cursor-pointer"></div>
          <div @click="close" class="w-6 h-6 rounded-full bg-green-500 cursor-pointer"></div>
        </div>
      </template>
    </ContextMenu>
  </div>
</template>
