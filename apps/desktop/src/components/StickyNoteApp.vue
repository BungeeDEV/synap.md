<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { load } from '@tauri-apps/plugin-store';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { Bold, Italic, Strikethrough, List, ListOrdered, CheckSquare, Code, Heading1, Heading2, X } from 'lucide-vue-next';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import { Extension } from '@tiptap/core';
import { buildEditorExtensions } from '@synap/editor-core';

const props = defineProps<{ file: string }>();

const content = ref('');
const vaultPath = ref('');
const saveStatus = ref('Bereit');
const fontSize = ref(16);

let saveTimeout: any = null;

const EditorHotkeys = Extension.create({
  name: 'editorHotkeys',
  addKeyboardShortcuts() {
    return {
      'Mod-s': () => {
        saveContent();
        return true;
      },
      'Mod-Enter': () => this.editor.chain().focus().toggleTaskList().run()
    }
  }
});

const editor = useEditor({
  content: '',
  extensions: [
    ...buildEditorExtensions({
      onWikilinkNavigate: () => {},
      slashCommandOptions: {
        onAttachmentInsert: () => {}
      }
    }),
    EditorHotkeys
  ],
  editorProps: {
    attributes: {
      class: 'prose max-w-none border-none shadow-none outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 p-4 pb-20 min-h-full dynamic-editor'
    }
  },
  onUpdate: ({ editor }) => {
    content.value = editor.storage.markdown.getMarkdown();
    scheduleSave();
  }
});

async function loadFileContent() {
    const store = await load('store.json', { autoSave: false });
    const storedPath = await store.get<string>('vaultPath');
    if (await store.has('editorFontSize')) {
        fontSize.value = await store.get<number>('editorFontSize') ?? 16;
    }
    
    if (storedPath) {
        vaultPath.value = storedPath;
        try {
            const fullPath = `${storedPath}/${props.file}`;
            const text = await readTextFile(fullPath);
            content.value = text;
            if (editor.value) {
                editor.value.commands.setContent(text, { emitUpdate: false });
            }
        } catch (e) {
            saveStatus.value = "Ladefehler";
        }
    }
}

onMounted(() => {
    loadFileContent();
    
    // Disable context menu in sticky note
    window.addEventListener('contextmenu', e => e.preventDefault());
    
    // Ctrl + Scroll to zoom
    window.addEventListener('wheel', async (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            if (e.deltaY < 0) {
                fontSize.value = Math.min(fontSize.value + 1, 48);
            } else if (e.deltaY > 0) {
                fontSize.value = Math.max(fontSize.value - 1, 10);
            }
            const store = await load('store.json', { autoSave: false });
            await store.set('editorFontSize', fontSize.value);
            await store.save();
        }
    }, { passive: false });
});

async function saveContent() {
    if (!vaultPath.value) return;
    saveStatus.value = "Speichere...";
    try {
        const fullPath = `${vaultPath.value}/${props.file}`;
        await writeTextFile(fullPath, content.value);
        saveStatus.value = "Gespeichert";
        setTimeout(() => saveStatus.value = "Bereit", 1500);
    } catch (e) {
        saveStatus.value = "Fehler beim Speichern";
    }
}

function scheduleSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveContent, 500);
}

function focusEditorIfOutsideContent(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (target.closest('.ProseMirror') || target.closest('.toolbar') || target.closest('.titlebar')) return;
  editor.value?.chain().focus('end').run();
}

async function closeWindow() {
  try {
    const appWindow = getCurrentWebviewWindow();
    await appWindow.close();
  } catch (e) {
    console.error("Failed to close:", e);
  }
}

async function startDrag() {
  try {
    const appWindow = getCurrentWebviewWindow();
    await appWindow.startDragging();
  } catch (e) {
    console.error("Failed to drag:", e);
  }
}
</script>

<style>
.dynamic-editor {
  font-size: var(--editor-font-size);
}
</style>

<template>
  <div class="h-screen w-screen flex flex-col bg-base font-sans text-content-primary overflow-hidden" @mousedown="focusEditorIfOutsideContent">
    <!-- Custom Title Bar -->
    <div data-tauri-drag-region @mousedown.self="startDrag" class="titlebar h-10 min-h-[40px] w-full flex items-center justify-between px-3 select-none cursor-move shadow-md z-10" style="background-color: var(--color-accent-DEFAULT); color: var(--color-base);">
      <span data-tauri-drag-region @mousedown.self="startDrag" class="text-sm font-semibold flex-1 truncate cursor-move" style="color: var(--color-base);">{{ props.file.split('/').pop() }}</span>
      <button @click="closeWindow" class="p-1 hover:bg-black/10 rounded-md transition-colors" style="color: var(--color-base);" title="Schließen">
        <X class="w-5 h-5 pointer-events-none" />
      </button>
    </div>

    <!-- Main Editor Area -->
    <div class="flex-1 overflow-y-auto" :style="{ '--editor-font-size': fontSize + 'px' }">
        <EditorContent :editor="editor" v-if="editor" class="h-full" />
    </div>

    <!-- Fixed Bottom Toolbar -->
    <div v-if="editor" class="toolbar w-full bg-surface-1 border-t border-divider px-2 py-1.5 flex items-center justify-between gap-1 overflow-x-auto shrink-0 scrollbar-hide">
      
      <!-- Grouped actions for narrower footprint -->
      <div class="flex items-center gap-1.5 shrink-0 flex-wrap">
        
        <!-- Text Group -->
        <div class="flex items-center bg-surface-2 rounded-md border border-divider-strong overflow-hidden">
            <button @click="editor.chain().focus().toggleBold().run()" :class="{ 'text-accent bg-accent/20': editor.isActive('bold') }" class="p-1 hover:bg-surface-1 transition-colors" title="Fett (Strg+B)">
            <Bold class="w-3.5 h-3.5" />
            </button>
            <div class="w-px h-3.5 bg-divider mx-0.5"></div>
            <button @click="editor.chain().focus().toggleItalic().run()" :class="{ 'text-accent bg-accent/20': editor.isActive('italic') }" class="p-1 hover:bg-surface-1 transition-colors" title="Kursiv (Strg+I)">
            <Italic class="w-3.5 h-3.5" />
            </button>
            <div class="w-px h-3.5 bg-divider mx-0.5"></div>
            <button @click="editor.chain().focus().toggleStrike().run()" :class="{ 'text-accent bg-accent/20': editor.isActive('strike') }" class="p-1 hover:bg-surface-1 transition-colors" title="Durchgestrichen">
            <Strikethrough class="w-3.5 h-3.5" />
            </button>
        </div>
        
        <!-- Headings Group -->
        <div class="flex items-center bg-surface-2 rounded-md border border-divider-strong overflow-hidden">
            <button @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" :class="{ 'text-accent bg-accent/20': editor.isActive('heading', { level: 1 }) }" class="p-1 hover:bg-surface-1 transition-colors" title="Überschrift 1">
            <Heading1 class="w-3.5 h-3.5" />
            </button>
            <div class="w-px h-3.5 bg-divider mx-0.5"></div>
            <button @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" :class="{ 'text-accent bg-accent/20': editor.isActive('heading', { level: 2 }) }" class="p-1 hover:bg-surface-1 transition-colors" title="Überschrift 2">
            <Heading2 class="w-3.5 h-3.5" />
            </button>
        </div>
        
        <!-- Lists Group -->
        <div class="flex items-center bg-surface-2 rounded-md border border-divider-strong overflow-hidden">
            <button @click="editor.chain().focus().toggleBulletList().run()" :class="{ 'text-accent bg-accent/20': editor.isActive('bulletList') }" class="p-1 hover:bg-surface-1 transition-colors" title="Aufzählung">
            <List class="w-3.5 h-3.5" />
            </button>
            <div class="w-px h-3.5 bg-divider mx-0.5"></div>
            <button @click="editor.chain().focus().toggleOrderedList().run()" :class="{ 'text-accent bg-accent/20': editor.isActive('orderedList') }" class="p-1 hover:bg-surface-1 transition-colors" title="Nummerierung">
            <ListOrdered class="w-3.5 h-3.5" />
            </button>
            <div class="w-px h-3.5 bg-divider mx-0.5"></div>
            <button @click="editor.chain().focus().toggleTaskList().run()" :class="{ 'text-accent bg-accent/20': editor.isActive('taskList') }" class="p-1 hover:bg-surface-1 transition-colors" title="Checkliste">
            <CheckSquare class="w-3.5 h-3.5" />
            </button>
        </div>

        <!-- Code -->
        <div class="flex items-center bg-surface-2 rounded-md border border-divider-strong overflow-hidden">
            <button @click="editor.chain().focus().toggleCodeBlock().run()" :class="{ 'text-accent bg-accent/20': editor.isActive('codeBlock') }" class="p-1 hover:bg-surface-1 transition-colors" title="Code Block">
            <Code class="w-3.5 h-3.5" />
            </button>
        </div>

      </div>
      
      <div class="text-[9px] text-content-tertiary uppercase tracking-wider text-right select-none pl-2 shrink-0">
        {{ saveStatus }}
      </div>
    </div>
  </div>
</template>
