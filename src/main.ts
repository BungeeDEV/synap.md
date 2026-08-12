import { createApp } from 'vue';
import './styles.css';
import App from './App.vue';
import StickyNoteApp from './components/StickyNoteApp.vue';

const urlParams = new URLSearchParams(window.location.search);
const isSticky = urlParams.get('sticky') === 'true';
const stickyFile = urlParams.get('file');

if (isSticky && stickyFile) {
    createApp(StickyNoteApp, { file: stickyFile }).mount('#app');
} else {
    createApp(App).mount('#app');
}
