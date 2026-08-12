<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { load } from '@tauri-apps/plugin-store';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { Bold, Italic, Strikethrough, List, ListOrdered, CheckSquare, Code, Heading1, Heading2 } from 'lucide-vue-next';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { Extension } from '@tiptap/core';

const props = defineProps<{ file: string }>();

const content = ref('');
const vaultPath = ref('');
const saveStatus = ref('Bereit');

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
    StarterKit,
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown,
    Placeholder.configure({ placeholder: 'Schreibe deine Sticky Note...' }),
    EditorHotkeys
  ],
  editorProps: {
    attributes: {
      class: 'prose prose-sm max-w-none border-none shadow-none outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 p-4 pb-20 min-h-full'
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
  if (target.closest('.ProseMirror') || target.closest('.toolbar')) return;
  editor.value?.chain().focus('end').run();
}
</script>

<template>
  <div class="h-screen w-screen flex flex-col bg-yellow-50/90 dark:bg-yellow-900/30 font-sans text-content-primary overflow-hidden" @mousedown="focusEditorIfOutsideContent">
    <!-- Main Editor Area -->
    <div class="flex-1 overflow-y-auto">
        <EditorContent :editor="editor" v-if="editor" class="h-full" />
    </div>

    <!-- Floating / Bottom Toolbar -->
    <div v-if="editor" class="toolbar absolute bottom-4 left-1/2 -translate-x-1/2 bg-surface-1/90 backdrop-blur shadow-lg border border-divider rounded-full px-4 py-2 flex items-center gap-2">
      <button @click="editor.chain().focus().toggleBold().run()" :class="{ 'text-accent bg-accent/10': editor.isActive('bold') }" class="p-1.5 rounded-md hover:bg-surface-2 transition-colors" title="Fett (Strg+B)">
        <Bold class="w-4 h-4" />
      </button>
      <button @click="editor.chain().focus().toggleItalic().run()" :class="{ 'text-accent bg-accent/10': editor.isActive('italic') }" class="p-1.5 rounded-md hover:bg-surface-2 transition-colors" title="Kursiv (Strg+I)">
        <Italic class="w-4 h-4" />
      </button>
      <button @click="editor.chain().focus().toggleStrike().run()" :class="{ 'text-accent bg-accent/10': editor.isActive('strike') }" class="p-1.5 rounded-md hover:bg-surface-2 transition-colors" title="Durchgestrichen (Strg+Shift+X)">
        <Strikethrough class="w-4 h-4" />
      </button>
      
      <div class="w-px h-4 bg-divider mx-1"></div>
      
      <button @click="editor.chain().focus().toggleHeading({ level: 1 }).run()" :class="{ 'text-accent bg-accent/10': editor.isActive('heading', { level: 1 }) }" class="p-1.5 rounded-md hover:bg-surface-2 transition-colors" title="Überschrift 1">
        <Heading1 class="w-4 h-4" />
      </button>
      <button @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" :class="{ 'text-accent bg-accent/10': editor.isActive('heading', { level: 2 }) }" class="p-1.5 rounded-md hover:bg-surface-2 transition-colors" title="Überschrift 2">
        <Heading2 class="w-4 h-4" />
      </button>
      
      <div class="w-px h-4 bg-divider mx-1"></div>
      
      <button @click="editor.chain().focus().toggleBulletList().run()" :class="{ 'text-accent bg-accent/10': editor.isActive('bulletList') }" class="p-1.5 rounded-md hover:bg-surface-2 transition-colors" title="Aufzählung">
        <List class="w-4 h-4" />
      </button>
      <button @click="editor.chain().focus().toggleOrderedList().run()" :class="{ 'text-accent bg-accent/10': editor.isActive('orderedList') }" class="p-1.5 rounded-md hover:bg-surface-2 transition-colors" title="Nummerierung">
        <ListOrdered class="w-4 h-4" />
      </button>
      <button @click="editor.chain().focus().toggleTaskList().run()" :class="{ 'text-accent bg-accent/10': editor.isActive('taskList') }" class="p-1.5 rounded-md hover:bg-surface-2 transition-colors" title="Checkliste (Strg+Enter)">
        <CheckSquare class="w-4 h-4" />
      </button>
      <button @click="editor.chain().focus().toggleCodeBlock().run()" :class="{ 'text-accent bg-accent/10': editor.isActive('codeBlock') }" class="p-1.5 rounded-md hover:bg-surface-2 transition-colors" title="Code Block">
        <Code class="w-4 h-4" />
      </button>
      
      <div class="ml-2 text-[10px] text-content-tertiary uppercase tracking-wider w-16 text-right select-none">
        {{ saveStatus }}
      </div>
    </div>
  </div>
</template>
