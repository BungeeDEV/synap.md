import { reactive, ref } from 'vue';

export interface FileItem {
  path: string;
  status: string;
}

export interface TreeNode {
  name: string;
  path: string; // Full relative path
  isDir: boolean;
  isOpen: boolean; // For folder toggle
  status?: string;
  children: TreeNode[];
}

export interface ContextMenuState {
  node: TreeNode;
  x: number;
  y: number;
  initialSubmenu?: string;
}

export interface TabState {
  path: string;
  content: string;
  dirty: boolean;
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'error';
  pendingCount: number;
  lastError: string | null;
  lastConflictPath: string | null;
}

export const appState = reactive({
  vaultPath: null as string | null,
  localFiles: [] as FileItem[],

  // Tabs & Editor State - each tab carries its own in-memory content/dirty
  // flag (mirrors the web app's Pinia tabs store) so switching the active
  // tab never re-reads the file from disk; App.vue's `activeContent`
  // computed and `saveTimeouts` map key off `activeFile`/tab.path instead
  // of a single global content field.
  activeFile: null as string | null,
  tabs: [] as TabState[],
  isReaderMode: false,
  
  // Editor Settings
  defaultView: 'editor' as 'editor' | 'reader',
  editorFontSize: 16,
  editorFontFamily: 'sans' as 'sans' | 'serif' | 'mono',
  editorLineHeight: 1.7,
  theme: 'dark' as 'dark' | 'light',
  accentColor: null as string | null,
  locale: 'de' as 'de' | 'en',
  
  // Settings & Sync State
  serverUrl: '',
  token: '',
  isAutostartEnabled: false,
  isAutoSyncEnabled: true,
  statusMsg: 'Bereit',
  justSaved: false,

  // Structured sync status - distinguishes "syncing now" / "N files
  // pending" / "error" instead of overloading statusMsg's single string
  // for everything. lastConflictPath is set when a push reports a real
  // conflict (server content kept as a local conflict copy); see App.vue's
  // `sync-conflict` listener.
  syncStatus: {
    state: 'idle',
    pendingCount: 0,
    lastError: null,
    lastConflictPath: null,
  } as SyncStatus,
  isSettingsOpen: false,
  isSidebarOpen: true,
  isSearchOpen: false,
  contextMenu: null as ContextMenuState | null,
  folderToDelete: null as TreeNode | null,
});

export function resetAppState() {
  appState.vaultPath = null;
  appState.localFiles = [];
  appState.activeFile = null;
  appState.tabs = [];
  appState.isReaderMode = false;
  appState.isSidebarOpen = true;
  appState.isSearchOpen = false;
  appState.contextMenu = null;
  appState.folderToDelete = null;
  appState.defaultView = 'editor';
  appState.editorFontSize = 16;
  appState.editorFontFamily = 'sans';
  appState.editorLineHeight = 1.7;
  appState.theme = 'dark';
  appState.accentColor = null;
  appState.locale = 'de';
  appState.serverUrl = '';
  appState.token = '';
  appState.isAutoSyncEnabled = true;
  appState.statusMsg = 'Bereit';
  appState.syncStatus = { state: 'idle', pendingCount: 0, lastError: null, lastConflictPath: null };
  appState.isSettingsOpen = false;
  fileTree.value = [];
  openFolders.clear();
}

// Persistent reactive file tree — survives re-syncs
export const fileTree = ref<TreeNode[]>([]);

// Track which folders are open (persists across rebuilds)
const openFolders = new Set<string>();

export function toggleFolder(path: string) {
  if (openFolders.has(path)) {
    openFolders.delete(path);
  } else {
    openFolders.add(path);
  }
  // Rebuild tree to apply the change reactively
  rebuildFileTree();
}

/** Call this whenever appState.localFiles changes */
export function rebuildFileTree() {
  const files = appState.localFiles;
  const root: TreeNode[] = [];
  
  for (const file of files) {
    const parts = file.path.split('/');
    let currentLevel = root;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');
      
      let existing = currentLevel.find(n => n.name === part);
      
      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          isDir: !isFile,
          isOpen: openFolders.has(currentPath), // Restore open state!
          status: isFile ? file.status : undefined,
          children: []
        };
        currentLevel.push(existing);
      } else {
        // Update status for existing files
        if (isFile) existing.status = file.status;
        // Preserve open state
        existing.isOpen = openFolders.has(currentPath);
      }
      
      currentLevel = existing.children;
    }
  }
  
  // Sort: Directories first, then alphabetical
  const sortTree = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir === b.isDir) return a.name.localeCompare(b.name);
      return a.isDir ? -1 : 1;
    });
    nodes.forEach(n => {
      if (n.isDir) sortTree(n.children);
    });
  };
  
  sortTree(root);
  fileTree.value = root;
}
