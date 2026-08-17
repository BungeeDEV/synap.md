<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n'
const { t, locale: i18nLocale } = useI18n();
import { invoke } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { readTextFile, writeTextFile, remove, rename, mkdir, copyFile } from '@tauri-apps/plugin-fs';
import {
  Folder, ExternalLink, Copy, FilePlus, FolderPlus, Download,
  Trash2, Edit2, Star, Share, FolderOutput, Info, Palette, StickyNote, X
} from '@lucide/vue';

import { appState, rebuildFileTree, resetAppState } from './store';
import { syncChannel, myWindowId, debounce, type SyncPayload } from './sync';
import type { ContextMenuGroup } from './contextMenuTypes';
import VaultSidebar from './components/VaultSidebar.vue';
import EditorWorkspace from './components/EditorWorkspace.vue';
import SettingsModal from './components/SettingsModal.vue';
import CommandPalette from './components/CommandPalette.vue';
import ContextMenu from './components/ContextMenu.vue';
import DeleteFolderModal from './components/DeleteFolderModal.vue';

onMounted(async () => {
    const store = await load('store.json', { autoSave: false });
    const storedPath = await store.get<string>('vaultPath');
    const storedUrl = await store.get<string>('serverUrl');
    const storedToken = await invoke<string>('get_secure_token').catch(() => null);

    try {
        const { isEnabled } = await import('@tauri-apps/plugin-autostart');
        appState.isAutostartEnabled = await isEnabled();
    } catch(e) { console.error("Autostart error", e); }

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
    if (await store.has('theme')) appState.theme = await store.get<any>('theme') ?? 'dark';
    if (await store.has('accentColor')) appState.accentColor = await store.get<any>('accentColor') ?? null;
    if (await store.has('locale')) appState.locale = await store.get<any>('locale') ?? 'de';

    // Watch for editor setting changes to auto-save
    watch(() => [
        appState.defaultView, 
        appState.editorFontSize, 
        appState.editorFontFamily, 
        appState.editorLineHeight,
        appState.theme,
        appState.accentColor,
        appState.locale
    ], async () => {
        const store = await load('store.json', { autoSave: false });
        await store.set('defaultView', appState.defaultView);
        await store.set('editorFontSize', appState.editorFontSize);
        await store.set('editorFontFamily', appState.editorFontFamily);
        await store.set('editorLineHeight', appState.editorLineHeight);
        await store.set('theme', appState.theme);
        await store.set('accentColor', appState.accentColor);
        await store.set('locale', appState.locale);
        await store.save();
    }, { deep: true });

    // Watch and apply theme/accentColor/locale
    watch(() => [appState.theme, appState.accentColor, appState.locale], async () => {
        document.documentElement.dataset.theme = appState.theme;
        i18nLocale.value = appState.locale;
        
        if (appState.accentColor) {
            document.documentElement.style.setProperty('--color-accent', appState.accentColor);
            const { computeAccentVariations } = await import('@synap/design-tokens');
            const vars = computeAccentVariations(appState.accentColor);
            if (vars) {
                document.documentElement.style.setProperty('--color-accent-soft', vars.soft);
                document.documentElement.style.setProperty('--color-accent-strong', vars.strong);
            }
        } else {
            document.documentElement.style.removeProperty('--color-accent');
            document.documentElement.style.removeProperty('--color-accent-soft');
            document.documentElement.style.removeProperty('--color-accent-strong');
        }
    }, { immediate: true });

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

    // Native Drag & Drop for .md files
    listen('tauri://drag-drop', async (event: any) => {
        if (!appState.vaultPath) return;
        const paths = event.payload.paths;
        if (Array.isArray(paths)) {
            for (const p of paths) {
                if (p.endsWith('.md')) {
                    const name = p.split(/[/\\]/).pop();
                    if (name) {
                        try {
                            await copyFile(p, `${appState.vaultPath}/${name}`);
                        } catch (e) { console.error('Drag drop import failed', e); }
                    }
                }
            }
            await refreshLocalFiles();
        }
    });

    // Listen for sync updates from other windows (e.g. Sticky Notes)
    syncChannel.onmessage = (event: MessageEvent<SyncPayload>) => {
        const payload = event.data;
        if (payload.senderId === myWindowId) return;

        // Update whichever open tab this applies to - not just the active
        // one. Since tab switches no longer re-read from disk (see
        // `loadFile`), a background tab's in-memory content would otherwise
        // go stale relative to what another window just wrote, and the next
        // edit in this window would silently overwrite that newer content.
        const syncedTab = appState.tabs.find(tab => tab.path === payload.file);
        if (syncedTab && payload.content !== syncedTab.content) {
            // Mutate content directly (not through the `activeContent`
            // computed setter) so this doesn't re-trigger the save/broadcast
            // loop below.
            syncedTab.content = payload.content;
            syncedTab.dirty = false;
        }
    };
});

async function createNewNote(targetPath?: string) {
    if (!appState.vaultPath) return;
    try {
        let i = 1;
        const prefix = targetPath ? `${targetPath}/` : '';
        const untitled = t('desktopApp.untitledNote');
        let newName = `${prefix}${untitled}.md`;
        while (appState.localFiles.find(f => f.path === newName)) {
            newName = `${prefix}${untitled} ${i}.md`;
            i++;
        }
        const fullPath = `${appState.vaultPath}/${newName}`;
        await writeTextFile(fullPath, t('desktopApp.newNoteHeading'));
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
        appState.statusMsg = t('desktopApp.vaultSyncActive');

        // Structured sync-state events emitted around every perform_sync()
        // call in lib.rs (both the file-watcher-triggered sync and the
        // periodic background loop) - the only signal available for syncs
        // that aren't kicked off by an invoke() from this window, since
        // those run purely on Rust-side timers/watchers.
        await listen('sync-started', () => {
            appState.syncStatus.state = 'syncing';
        });
        await listen('sync-done', (event: any) => {
            const payload = event.payload as { ok: boolean; error?: string | null };
            if (payload?.ok) {
                appState.syncStatus.state = 'idle';
                appState.syncStatus.lastError = null;
            } else {
                appState.syncStatus.state = 'error';
                appState.syncStatus.lastError = payload?.error ?? null;
            }
            refreshLocalFiles();
        });
        // Emitted from push_file's existing conflict branch (kept-local +
        // server-version-as-conflict-copy, per the Konfliktstrategie in
        // docs/sync-plan.md). Surfaced as a persistent notice instead of
        // only the OS notification that command already shows.
        await listen('sync-conflict', (event: any) => {
            const payload = event.payload as { path?: string };
            if (payload?.path) appState.syncStatus.lastConflictPath = payload.path;
        });
    } catch (e: any) {
        appState.statusMsg = t('desktopApp.appError', { error: e });
    }
}

async function refreshLocalFiles() {
    try {
        appState.localFiles = await invoke<any[]>('get_local_files');
        rebuildFileTree();
        appState.syncStatus.pendingCount = appState.localFiles.filter(f => f.status !== 'Synced').length;
    } catch (e: any) {
        appState.statusMsg = t('desktopApp.errorLoadingFiles', { error: e });
    }
}

async function manualSync() {
    appState.statusMsg = t('desktopApp.syncingWithServer');
    appState.syncStatus.state = 'syncing';
    try {
        const store = await load('store.json', { autoSave: false });
        await store.set('serverUrl', appState.serverUrl);
        await invoke('set_secure_token', { token: appState.token });
        await store.save();

        if (appState.isAutoSyncEnabled) {
            await invoke('start_background_sync', { url: appState.serverUrl, token: appState.token });
        }
        await invoke('sync_now', { url: appState.serverUrl, token: appState.token });
        await refreshLocalFiles();
        appState.statusMsg = t('desktopApp.synced');
        appState.syncStatus.state = 'idle';
        appState.syncStatus.lastError = null;
    } catch (e: any) {
        appState.statusMsg = t('desktopApp.genericError', { error: e });
        appState.syncStatus.state = 'error';
        appState.syncStatus.lastError = String(e);
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
    if (!confirm(t('desktopApp.resetConfirm'))) {
        return;
    }
    
    try {
        // Stop sync and delete db
        await invoke('wipe_sync_db');
        
        // Clear Tauri store
        const store = await load('store.json', { autoSave: false });
        await store.clear();
        await store.save();
        
        await invoke('delete_secure_token').catch(() => {});
        
        // Clear global state
        resetAppState();
    } catch (e: any) {
        console.error("Failed to wipe app:", e);
        alert(t('desktopApp.resetError', { error: e }));
    }
}

async function loadFile(path: string) {
    if (!appState.vaultPath) return;

    // Already open: just switch which tab is active, no disk read - its
    // content is already in memory (kept up to date by the syncChannel
    // handler above and by the `activeContent` setter below).
    const existing = appState.tabs.find(tab => tab.path === path);
    if (existing) {
        appState.activeFile = path;
        appState.isReaderMode = appState.defaultView === 'reader';
        return;
    }

    try {
        const fullPath = `${appState.vaultPath}/${path}`;
        const content = await readTextFile(fullPath);
        appState.tabs.push({ path, content, dirty: false });
        appState.activeFile = path;
        appState.isReaderMode = appState.defaultView === 'reader';
    } catch (e: any) {
        appState.statusMsg = t('desktopApp.loadErrorPrefix', { error: e });
    }
}

function getActiveTab() {
    return appState.tabs.find(tab => tab.path === appState.activeFile) ?? null;
}

const broadcastUpdate = debounce((file: string, content: string) => {
    syncChannel.postMessage({ file, content, senderId: myWindowId });
}, 200);

// Per-tab debounced save timers, keyed by path. Each timer closes over its
// own `path`/`content` at schedule time, so two tabs' pending saves can
// never collide the way a single global timer could (see 640410f) - that
// fix is now redundant (each tab owns its content, so a stale-timer write
// can only ever land on its own file) and has been removed from loadFile
// above in favor of this per-path map.
const saveTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleSave(path: string, content: string) {
    const pending = saveTimeouts.get(path);
    if (pending) clearTimeout(pending);

    saveTimeouts.set(path, setTimeout(async () => {
        saveTimeouts.delete(path);
        if (!appState.vaultPath) return;
        try {
            const fullPath = `${appState.vaultPath}/${path}`;
            await writeTextFile(fullPath, content);
            const tab = appState.tabs.find(t => t.path === path);
            if (tab) tab.dirty = false;
            if (appState.activeFile === path) {
                appState.statusMsg = t('desktopApp.saved');
                appState.justSaved = true;
                setTimeout(() => appState.justSaved = false, 500);
            }
        } catch (e: any) {
            appState.statusMsg = t('desktopApp.genericError', { error: e });
        }
    }, 500));
}

// v-model target for EditorWorkspace: proxies to the active tab's content so
// the editor component doesn't need to know about the tabs array shape.
const activeContent = computed({
    get: () => getActiveTab()?.content ?? '',
    set: (newVal: string) => {
        const tab = getActiveTab();
        if (!tab || !appState.vaultPath) return;
        tab.content = newVal;
        tab.dirty = true;

        // Broadcast immediately to other windows (debounced internally)
        broadcastUpdate(tab.path, newVal);
        scheduleSave(tab.path, newVal);
    }
});

// -- Context Menu Logic --
const contextMenuGroups = computed<ContextMenuGroup[]>(() => {
  if (!appState.contextMenu) return [];
  const node = appState.contextMenu.node;
  
  const handleRename = async () => {
    const newName = prompt(t('desktopApp.renamePrompt'), node.name);
    if (newName && newName !== node.name && appState.vaultPath) {
      const oldPath = `${appState.vaultPath}/${node.path}`;
      const newPathStr = node.path.substring(0, node.path.length - node.name.length) + newName + (node.isDir ? '' : (newName.endsWith('.md') ? '' : '.md'));
      const newFullPath = `${appState.vaultPath}/${newPathStr}`;
      try {
        await rename(oldPath, newFullPath);
        await refreshLocalFiles();
        const renamedTab = appState.tabs.find(tab => tab.path === node.path);
        if (renamedTab) renamedTab.path = newPathStr;
        if (appState.activeFile === node.path) {
          appState.activeFile = newPathStr;
        }
      } catch (e) { alert(t('desktopApp.renameError', { error: e })); }
    }
  };

  if (node.isDir) {
    return [
      [
        { id: 'new_note', label: t('desktopApp.ctxNewNoteHere'), icon: FilePlus, onSelect: () => createNewNote(node.path) },
        { id: 'new_folder', label: t('tree.newFolder'), icon: FolderPlus, onSelect: async () => {
           if (!appState.vaultPath) return;
           const folderName = prompt(t('desktopApp.newSubfolderPrompt'));
           if (folderName) {
               try {
                   await mkdir(`${appState.vaultPath}/${node.path}/${folderName}`);
                   await refreshLocalFiles();
               } catch(e) { alert(t('desktopApp.genericError', { error: e })); }
           }
        }},
        { id: 'import', label: t('desktopApp.ctxImportFiles'), icon: Download, onSelect: () => console.log('Import', node.path) },
        { id: 'favorite', label: t('desktopApp.ctxFavorite'), icon: Star, onSelect: () => console.log('Fav', node.path) },
      ],
      [
        { id: 'rename', label: t('tree.rename'), icon: Edit2, onSelect: handleRename },
        { id: 'move', label: t('desktopApp.ctxMoveTo'), icon: FolderOutput, submenu: 'move' },
        { id: 'export_zip', label: t('desktopApp.ctxExportZip'), icon: Download, onSelect: () => console.log('Export ZIP', node.path) },
        { id: 'stats', label: t('desktopApp.ctxFolderStats'), icon: Info, onSelect: () => console.log('Stats', node.path) },
        { id: 'color', label: t('desktopApp.ctxChangeColor'), icon: Palette, submenu: 'color' },
      ],
      [
        { id: 'delete', label: t('tree.delete'), icon: Trash2, danger: true, onSelect: () => {
           appState.folderToDelete = node;
        }},
      ]
    ];
  } else {
    return [
      [
        { id: 'open_new', label: t('desktopApp.ctxOpenNewTab'), icon: ExternalLink, onSelect: () => loadFile(node.path) },
        { id: 'sticky', label: t('desktopApp.ctxOpenSticky'), icon: StickyNote, onSelect: async () => {
             try {
                 await invoke('open_sticky', { path: node.path });
             } catch(e) { alert(t('desktopApp.genericError', { error: e })); }
        }},
        { id: 'rename', label: t('tree.rename'), icon: Edit2, onSelect: handleRename },
        { id: 'favorite', label: t('desktopApp.ctxFavorite'), icon: Star, onSelect: () => console.log('Fav', node.path) },
      ],
      [
        { id: 'duplicate', label: t('tree.duplicate'), icon: Copy, onSelect: async () => {
           if (!appState.vaultPath) return;
           const copyPath = node.path.replace(/\.md$/, ' (Kopie).md');
           try {
             await copyFile(`${appState.vaultPath}/${node.path}`, `${appState.vaultPath}/${copyPath}`);
             await refreshLocalFiles();
           } catch(e) { alert(t('desktopApp.genericError', { error: e })); }
        }},
        { id: 'move', label: t('desktopApp.ctxMoveTo'), icon: FolderOutput, submenu: 'move' },
        { id: 'copy_link', label: t('desktopApp.ctxCopyLink'), icon: Copy, onSelect: async () => {
           try {
             await navigator.clipboard.writeText(`synap://${node.path}`);
             appState.statusMsg = t('desktopApp.linkCopied');
           } catch(e) { console.error(e); }
        }},
        { id: 'share', label: t('desktopApp.ctxShare'), icon: Share, onSelect: () => console.log('Share', node.path) },
        { id: 'export', label: t('desktopApp.ctxExport'), icon: Download, submenu: 'export' },
        { id: 'details', label: t('desktopApp.ctxShowDetails'), icon: Info, onSelect: () => alert(t('desktopApp.fileDetails', { name: node.name, path: node.path })) },
      ],
      [
        { id: 'archive', label: t('desktopApp.ctxArchive'), icon: FolderOutput, onSelect: () => console.log('Archive', node.path) },
        { id: 'delete', label: t('tree.delete'), icon: Trash2, danger: true, onSelect: async () => {
           if (!confirm(t('desktopApp.deleteFileConfirm', { name: node.name }))) return;
           if (appState.vaultPath) {
             const fp = `${appState.vaultPath}/${node.path}`;
             try {
               await remove(fp);
               await refreshLocalFiles();

               // Cancel any pending debounced save for this file - it would
               // otherwise fire after deletion and silently recreate the
               // file with stale content. Keyed by path, so this can only
               // ever touch the deleted file's own timer.
               const pending = saveTimeouts.get(node.path);
               if (pending) {
                 clearTimeout(pending);
                 saveTimeouts.delete(node.path);
               }

               const tabIndex = appState.tabs.findIndex(tab => tab.path === node.path);
               if (tabIndex > -1) {
                 appState.tabs.splice(tabIndex, 1);
                 if (appState.activeFile === node.path) {
                   const fallback = appState.tabs[tabIndex] ?? appState.tabs[tabIndex - 1];
                   appState.activeFile = fallback?.path ?? null;
                 }
               }
             } catch(e) { alert(t('desktopApp.deleteFileError', { error: e })); }
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
      <h2 class="text-2xl font-bold text-content-primary tracking-tight">{{ t('desktopSettings.selectVault') }}</h2>
      <p class="text-content-secondary mb-4 text-center max-w-sm">{{ t('desktopSettings.selectVaultDesc') }}</p>
      <button @click="selectVaultFolder" class="btn-primary">
        <Folder class="w-4 h-4" stroke-width="1.5" />{{ t('desktopSettings.selectFolderBtn') }}</button>
    </div>

    <!-- Main App Layout: horizontal flex, fills remaining height -->
    <div v-else class="flex flex-1 min-h-0 overflow-hidden">
      <!-- Modular Sidebar (fixed 256px, internal flex-col) -->
      <VaultSidebar v-if="appState.isSidebarOpen" @select="loadFile" @new-note="createNewNote" />

      <!-- Modular Workspace (flex-1, fills rest) -->
      <EditorWorkspace v-model="activeContent" />
    </div>

    <!-- Modals (fixed overlays, unaffected by layout) -->
    <SettingsModal @sync="manualSync" @change-vault="changeVault" @reset-app="resetApp" @toggle-auto-sync="toggleAutoSync" />
    <CommandPalette @select="loadFile" />
    <DeleteFolderModal />
    
    <ContextMenu 
      v-if="appState.contextMenu"
      :groups="contextMenuGroups"
      @close="appState.contextMenu = null"
    >
      <template #move="{ close }">
        <div class="bg-surface-2 p-3 text-[13px] rounded shadow-md border border-divider w-48">
          <p class="font-semibold mb-2">{{ t('desktopSettings.moveTo') }}</p>
          <p class="text-content-tertiary">{{ t('desktopSettings.selectTarget') }}</p>
          <button @click="close" class="mt-2 text-accent">{{ t('desktopSettings.cancelDesktop') }}</button>
        </div>
      </template>
      <template #export="{ close }">
        <div class="bg-surface-2 p-2 text-[13px] rounded shadow-md border border-divider flex flex-col gap-1 w-40">
          <button @click="close" class="text-left px-2 py-1.5 hover:bg-surface-1 rounded">{{ t('desktopSettings.asMarkdownDesktop') }}</button>
          <button @click="close" class="text-left px-2 py-1.5 hover:bg-surface-1 rounded">{{ t('desktopSettings.printPdfDesktop') }}</button>
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

    <!-- Persistent sync-conflict notice - stays until dismissed (not a
         transient toast), since silently losing track of a conflict copy
         is exactly the failure mode this is meant to prevent. -->
    <div
      v-if="appState.syncStatus.lastConflictPath"
      class="fixed top-3 right-3 z-50 flex items-start gap-3 rounded-lg border border-border-strong bg-surface-1 px-4 py-3 shadow-float max-w-sm"
    >
      <div class="w-2 h-2 rounded-full bg-danger mt-1.5 shrink-0"></div>
      <div class="min-w-0">
        <p class="text-[13px] font-medium text-content-primary">{{ t('desktopApp.syncConflictTitle') }}</p>
        <p class="text-[13px] text-content-secondary break-words">{{ t('desktopApp.syncConflictBody', { path: appState.syncStatus.lastConflictPath }) }}</p>
      </div>
      <button
        @click="appState.syncStatus.lastConflictPath = null"
        class="text-content-tertiary hover:text-content-primary shrink-0"
        :aria-label="t('desktopApp.dismiss')"
      >
        <X class="w-4 h-4" stroke-width="2" />
      </button>
    </div>
  </div>
</template>
