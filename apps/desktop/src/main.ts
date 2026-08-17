import { createApp } from 'vue';
import 'katex/dist/katex.min.css';
import './styles.css';
import App from './App.vue';
import StickyNoteApp from './components/StickyNoteApp.vue';

const urlParams = new URLSearchParams(window.location.search);
const isSticky = urlParams.get('sticky') === 'true';
const stickyFile = urlParams.get('file');

import { createPinia } from 'pinia';
import { setSynapApi } from '@synap/store';

setSynapApi({
  async fetchTree() { return []; },
  async fetchFile() { return { content: '', mtime: '' }; },
  async deleteFile() {},
  async archiveNode() {},
  async renameNode() { return { path: '', mtime: '', updatedBacklinks: [] }; },
  async createFile() {},
  async createFolder() {},
  async noteFromTemplate() {},
  async listTemplates() { return []; },
  async dailyNote() { return { path: '', created: false }; },
  async duplicateNode() { return { path: '' }; },
  async renderNote() { return { html: '' }; },
  async fetchPreferences() { return {}; },
  async updatePreferences() { return {}; }
});

const pinia = createPinia();

import { createSynapI18n } from '@synap/i18n';
const i18n = createSynapI18n();

if (isSticky && stickyFile) {
    createApp(StickyNoteApp, { file: stickyFile }).use(pinia).use(i18n).mount('#app');
} else {
    createApp(App).use(pinia).use(i18n).mount('#app');
}
