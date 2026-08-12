import { setSynapApi } from '@synap/store'

export default defineNuxtPlugin((nuxtApp) => {
  setSynapApi({
    async fetchTree() {
      return await $fetch('/api/vault/tree')
    },
    async fetchFile(path) {
      return await $fetch('/api/vault/file', { query: { path } })
    },
    async deleteFile(path) {
      return await $fetch('/api/vault/file', { method: 'DELETE', query: { path } })
    },
    async archiveNode(path) {
      return await $fetch('/api/vault/archive', { method: 'POST', body: { path } })
    },
    async renameNode(oldPath, newPath) {
      return await $fetch('/api/vault/rename', { method: 'POST', body: { oldPath, newPath } })
    },
    async createFile(path, content) {
      return await $fetch('/api/vault/file', { method: 'PUT', body: { path, content } })
    },
    async createFolder(path) {
      return await $fetch('/api/vault/folder', { method: 'POST', body: { path } })
    },
    async noteFromTemplate(path, templateName) {
      return await $fetch('/api/vault/note-from-template', { method: 'POST', body: { path, templateName } })
    },
    async listTemplates() {
      return await $fetch('/api/templates/list')
    },
    async dailyNote() {
      return await $fetch('/api/vault/daily-note', { method: 'POST' })
    },
    async duplicateNode(path) {
      return await $fetch('/api/vault/duplicate', { method: 'POST', body: { path } })
    },
    async renderNote(path) {
      return await $fetch('/api/vault/render', { query: { path } })
    },
    async fetchPreferences() {
      return await $fetch('/api/settings/preferences')
    },
    async updatePreferences(patch) {
      return await $fetch('/api/settings/preferences', { method: 'PUT', body: patch })
    }
  })
})
