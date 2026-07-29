<script setup lang="ts">
import { Archive, ArrowUpDown, Calendar, ChevronRight, ChevronsDownUp, ChevronsUpDown, File, FilePlus, Folder, FolderOpen, FolderPlus, LayoutTemplate, MoreHorizontal, Move, Pencil, Star, Trash2, Upload } from 'lucide-vue-next'
import type { VaultTreeNode } from '~/stores/vaultTree'
import { sortVaultTree, VAULT_SORT_LABELS } from '~/utils/sortVaultTree'
import { validateRawName } from '#shared/validateFileName'
import { isValidMoveTarget, parentFolderOf } from '~/utils/vaultMove'

const { isFavorite, toggleFavorite } = useFavorites()
const { openImportDialog, recentlyImported } = useVaultImport()

const props = withDefaults(defineProps<{ nodes?: VaultTreeNode[] | null, parentPath?: string }>(), { nodes: null, parentPath: '' })

const isRoot = props.nodes === null
const vaultTree = useVaultTreeStore()
const tabs = useTabsStore()
const vaultSort = useVaultSort()
const mobileNav = useMobileNavStore()
const toast = useToast()

interface RenameResponse {
  path: string
  mtime: string
  updatedBacklinks: string[]
}

async function applyRenameResponse(response: RenameResponse): Promise<void> {
  await tabs.reconcileExternalContent(response.updatedBacklinks)
  if (response.updatedBacklinks.length > 0) {
    toast.show(`${response.updatedBacklinks.length} Backlinks aktualisiert`)
  }
}

// Sorted once at the root from the raw store tree (recursively, children
// included) - nested instances then just render the already-sorted
// `node.children` they're passed, same as before this component sorted at all.
const displayNodes = computed(() => {
  const source = props.nodes ?? vaultTree.tree
  return isRoot ? sortVaultTree(source, vaultSort.mode.value) : source
})

const sortTitle = computed(() => `Sortierung: ${VAULT_SORT_LABELS[vaultSort.mode.value]}`)

// Shared across every recursive VaultTree instance via useState - a plain
// ref here would be local per-instance, so a right-click on a node rendered
// by a nested (non-root) instance would never reach the root's menu overlay.
const contextMenu = useState<{ node: VaultTreeNode, x: number, y: number } | null>('vaultTreeContextMenu', () => null)
const pendingDelete = useState<VaultTreeNode | null>('vaultTreePendingDelete', () => null)
const moveDialogTarget = useState<VaultTreeNode | null>('vaultTreeMoveDialogTarget', () => null)

export interface TreeEditState {
  kind: 'create-file' | 'create-folder' | 'rename'
  parentPath: string
  node?: VaultTreeNode
  value: string
  error: string | null
  // Only set when this create-file was started from "Neu aus Vorlage" -
  // routes submitEdit to note-from-template.post.ts instead of the plain
  // empty-file PUT. Absent (not just falsy) for every other create/rename.
  templateName?: string
}

// Only one inline create/rename can be active at a time, and the folder it
// targets may be rendered by a different recursive instance than the one
// that triggered it (toolbar/context menu only exist on the root) - shared
// state for the same reason as contextMenu above.
const editState = useState<TreeEditState | null>('vaultTreeEditState', () => null)

if (isRoot) {
  onMounted(() => { void vaultTree.refresh() })
}

function isExpanded(node: VaultTreeNode): boolean {
  return vaultTree.isExpanded(node.path)
}

// Small fixed palette (Outline-style colored collection icons) instead of a
// new accent hue - these are Tailwind's built-in default colors, not
// arbitrary values, so STYLEGUIDE.md's "named tokens only" rule still holds.
// Hashed by path (not name) so same-named folders in different parents don't
// collide, and a folder keeps its color across sibling reordering/sorting.
const FOLDER_ICON_COLORS = ['text-orange-400', 'text-emerald-400', 'text-sky-400', 'text-violet-400', 'text-amber-400', 'text-rose-400']

function folderIconColor(path: string): string {
  let hash = 0
  for (let i = 0; i < path.length; i++) hash = (hash * 31 + path.charCodeAt(i)) | 0
  return FOLDER_ICON_COLORS[Math.abs(hash) % FOLDER_ICON_COLORS.length]!
}

function nodeIcon(node: VaultTreeNode): typeof File | typeof Folder | typeof FolderOpen {
  if (node.type === 'file') return File
  return isExpanded(node) ? FolderOpen : Folder
}

function onNodeClick(node: VaultTreeNode): void {
  if (node.type === 'folder') {
    vaultTree.toggleExpand(node.path)
    vaultTree.selectFolder(node.path)
  } else {
    vaultTree.selectFolder(parentFolderOf(node.path))
    void tabs.openTab(node.path)
    mobileNav.close()
  }
}

function onContextMenu(event: MouseEvent, node: VaultTreeNode): void {
  event.preventDefault()
  closeTemplateMenu()
  contextMenu.value = { node, x: event.clientX, y: event.clientY }
}

function closeContextMenu(): void {
  contextMenu.value = null
}

const deleteConfirmMessage = computed(() => `"${pendingDelete.value?.name}" wirklich löschen?`)

function requestDelete(node: VaultTreeNode): void {
  closeContextMenu()
  pendingDelete.value = node
}

async function confirmDelete(): Promise<void> {
  const node = pendingDelete.value
  pendingDelete.value = null
  if (!node) return

  await $fetch('/api/vault/file', { method: 'DELETE', query: { path: node.path } })
  tabs.closeTab(node.path)
  await vaultTree.refresh()
  toast.show(`"${node.name}" in den Papierkorb verschoben`)
}

async function archiveNode(node: VaultTreeNode): Promise<void> {
  closeContextMenu()
  try {
    await $fetch('/api/vault/archive', { method: 'POST', body: { path: node.path } })
    tabs.closeTab(node.path)
    await vaultTree.refresh()
    toast.show(`"${node.name}" archiviert`)
  } catch {
    toast.show('Archivieren fehlgeschlagen', 'error')
  }
}

function openMoveDialog(node: VaultTreeNode): void {
  closeContextMenu()
  moveDialogTarget.value = node
}

async function confirmMove(targetFolderPath: string): Promise<void> {
  const node = moveDialogTarget.value
  if (!node) return
  const ok = await moveNode({ path: node.path, type: node.type }, targetFolderPath)
  if (ok) moveDialogTarget.value = null
}

// --- Inline create/rename ---

function findNodeByPath(nodes: VaultTreeNode[], path: string): VaultTreeNode | null {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.type === 'folder' && node.children) {
      const found = findNodeByPath(node.children, path)
      if (found) return found
    }
  }
  return null
}

function siblingsOf(parentPath: string): VaultTreeNode[] {
  if (!parentPath) return vaultTree.tree
  return findNodeByPath(vaultTree.tree, parentPath)?.children ?? []
}

function baseNameOf(node: VaultTreeNode): string {
  if (node.type === 'file' && node.name.toLowerCase().endsWith('.md')) {
    return node.name.slice(0, -3)
  }
  return node.name
}

function buildCandidatePath(rawValue: string, parentPath: string, appendMdExtension: boolean): string {
  const trimmed = rawValue.trim()
  const finalName = appendMdExtension ? `${trimmed}.md` : trimmed
  return parentPath ? `${parentPath}/${finalName}` : finalName
}

function collidesWithSibling(candidatePath: string, parentPath: string, excludePath?: string): boolean {
  return siblingsOf(parentPath).some((n) => n.path === candidatePath && n.path !== excludePath)
}

function startCreate(kind: 'create-file' | 'create-folder', parentPath: string): void {
  closeContextMenu()
  closeTemplateMenu()
  if (parentPath) vaultTree.expand(parentPath)
  editState.value = { kind, parentPath, value: 'Untitled', error: null }
}

function startRename(node: VaultTreeNode): void {
  closeContextMenu()
  closeTemplateMenu()
  editState.value = { kind: 'rename', parentPath: parentFolderOf(node.path), node, value: baseNameOf(node), error: null }
}

function cancelEdit(): void {
  editState.value = null
}

function updateEditValue(value: string): void {
  if (!editState.value) return
  editState.value = { ...editState.value, value, error: null }
}

function errorMessageOf(err: unknown, fallback: string): string {
  const statusMessage = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
  return statusMessage ?? fallback
}

async function submitEdit(): Promise<void> {
  const state = editState.value
  if (!state) return

  const rawError = validateRawName(state.value)
  if (rawError) {
    editState.value = { ...state, error: rawError }
    return
  }

  if (state.kind === 'rename') {
    const node = state.node!
    const wasMarkdown = node.type === 'file' && node.name.toLowerCase().endsWith('.md')
    const newPath = buildCandidatePath(state.value, state.parentPath, wasMarkdown)

    if (newPath === node.path) {
      editState.value = null
      return
    }
    if (collidesWithSibling(newPath, state.parentPath, node.path)) {
      editState.value = { ...state, error: 'Existiert bereits in diesem Ordner' }
      return
    }

    try {
      const response = await $fetch<RenameResponse>('/api/vault/rename', { method: 'POST', body: { oldPath: node.path, newPath } })
      tabs.renameTab(node.path, newPath)
      editState.value = null
      await applyRenameResponse(response)
      await vaultTree.refresh()
    } catch (err) {
      editState.value = { ...state, error: errorMessageOf(err, 'Umbenennen fehlgeschlagen') }
    }
    return
  }

  const isFile = state.kind === 'create-file'
  const path = buildCandidatePath(state.value, state.parentPath, isFile)

  if (collidesWithSibling(path, state.parentPath)) {
    editState.value = { ...state, error: 'Existiert bereits in diesem Ordner' }
    return
  }

  try {
    if (isFile && state.templateName) {
      await $fetch('/api/vault/note-from-template', { method: 'POST', body: { path, templateName: state.templateName } })
      toast.show('Notiz aus Vorlage erstellt')
    } else if (isFile) {
      await $fetch('/api/vault/file', { method: 'PUT', body: { path, content: '' } })
    } else {
      await $fetch('/api/vault/folder', { method: 'POST', body: { path } })
    }
    editState.value = null
    await vaultTree.refresh()
    if (isFile) await tabs.openTab(path)
  } catch (err) {
    editState.value = { ...state, error: errorMessageOf(err, 'Erstellen fehlgeschlagen') }
  }
}

// --- Daily note + "Neu aus Vorlage" (Aufgabe E) ---

interface TemplateOption { name: string, path: string }

const showTemplateMenu = ref(false)
const templateOptions = ref<TemplateOption[]>([])
const loadingTemplates = ref(false)

async function toggleTemplateMenu(): Promise<void> {
  closeContextMenu()
  showTemplateMenu.value = !showTemplateMenu.value
  if (!showTemplateMenu.value || templateOptions.value.length > 0) return

  loadingTemplates.value = true
  try {
    templateOptions.value = await $fetch<TemplateOption[]>('/api/templates/list')
  } finally {
    loadingTemplates.value = false
  }
}

function closeTemplateMenu(): void {
  showTemplateMenu.value = false
}

const showOverflowMenu = ref(false)

function toggleOverflowMenu(): void {
  closeContextMenu()
  closeTemplateMenu()
  showOverflowMenu.value = !showOverflowMenu.value
}

function closeOverflowMenu(): void {
  showOverflowMenu.value = false
  closeTemplateMenu()
}

function openTemplateFromOverflow(): void {
  showOverflowMenu.value = false
  void toggleTemplateMenu()
}

function pickTemplate(template: TemplateOption): void {
  showTemplateMenu.value = false
  const parentPath = vaultTree.selectedFolder
  if (parentPath) vaultTree.expand(parentPath)
  editState.value = { kind: 'create-file', parentPath, value: 'Untitled', error: null, templateName: template.name }
}

// --- Import .md files from the OS (native file picker) ---

const importFileInputRef = ref<HTMLInputElement | null>(null)
const importPickerTargetFolder = ref('')

function triggerImportPicker(targetFolder: string): void {
  closeContextMenu()
  showOverflowMenu.value = false
  importPickerTargetFolder.value = targetFolder
  importFileInputRef.value?.click()
}

function onImportInputChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const files = input.files ? Array.from(input.files) : []
  input.value = ''
  if (files.length > 0) openImportDialog(files, importPickerTargetFolder.value)
}

async function openDailyNote(): Promise<void> {
  try {
    const response = await $fetch<{ path: string, created: boolean }>('/api/vault/daily-note', { method: 'POST' })
    if (response.created) await vaultTree.refresh()
    await tabs.openTab(response.path)
    mobileNav.close()
  } catch (err) {
    toast.show(errorMessageOf(err, 'Tagesnotiz konnte nicht erstellt werden'), 'error')
  }
}

// --- Move (shared by native HTML5 drag & drop and the "Verschieben nach..." dialog) ---

type DragDescriptor = { path: string, type: 'file' | 'folder' }

/** Executes a validated move: renames on disk, keeps any open tabs pointed at the new path, refreshes the tree. */
async function moveNode(source: DragDescriptor, targetFolderPath: string): Promise<boolean> {
  const name = source.path.split('/').pop()!
  const newPath = targetFolderPath ? `${targetFolderPath}/${name}` : name

  try {
    const response = await $fetch<RenameResponse>('/api/vault/rename', { method: 'POST', body: { oldPath: source.path, newPath } })

    if (source.type === 'file') {
      tabs.renameTab(source.path, newPath)
    } else {
      const oldPrefix = `${source.path}/`
      for (const tab of tabs.tabs) {
        if (tab.path.startsWith(oldPrefix)) {
          tabs.renameTab(tab.path, newPath + tab.path.slice(source.path.length))
        }
      }
    }

    await applyRenameResponse(response)
    if (targetFolderPath) vaultTree.expand(targetFolderPath)
    await vaultTree.refresh()
    return true
  } catch {
    await vaultTree.refresh()
    return false
  }
}

// --- Drag & drop (move between folders only, native HTML5 DnD) ---

const dragState = useState<DragDescriptor | null>('vaultTreeDragState', () => null)
const dragOverPath = useState<string | null>('vaultTreeDragOverPath', () => null)

function isValidDropTarget(dragging: DragDescriptor | null, target: VaultTreeNode): dragging is DragDescriptor {
  return dragging !== null && target.type === 'folder' && isValidMoveTarget(dragging, target.path)
}

function onDragStart(event: DragEvent, node: VaultTreeNode): void {
  dragState.value = { path: node.path, type: node.type }
  event.dataTransfer?.setData('text/plain', node.path)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragEnd(): void {
  dragState.value = null
  dragOverPath.value = null
}

// --- External file drag & drop (importing .md files from the OS) ---
//
// Internal tree-reorder drags (above) only ever carry a "text/plain" payload
// via setData() - real OS files dragged in from Explorer/Finder always
// expose a "Files" entry in dataTransfer.types (readable during dragover,
// unlike .files/.items which browsers only populate on the actual drop for
// security). That's the one reliable signal to branch on, not timing or
// pointer position.

const externalDragOverPath = useState<string | null>('vaultTreeExternalDragOverPath', () => null)
const rootDragActive = useState<boolean>('vaultTreeRootDragActive', () => false)

function isExternalFileDrag(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false
}

function onDragOver(event: DragEvent, node: VaultTreeNode): void {
  if (isExternalFileDrag(event)) {
    if (node.type !== 'folder') return // not a valid import target - let it bubble to the root drop-anywhere overlay
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    externalDragOverPath.value = node.path
    rootDragActive.value = false
    return
  }

  if (!isValidDropTarget(dragState.value, node)) {
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'
    return
  }
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverPath.value = node.path
}

function onDragLeave(event: DragEvent, node: VaultTreeNode): void {
  if (isExternalFileDrag(event)) {
    if (externalDragOverPath.value === node.path) externalDragOverPath.value = null
    return
  }
  if (dragOverPath.value === node.path) dragOverPath.value = null
}

async function onDrop(event: DragEvent, node: VaultTreeNode): Promise<void> {
  if (isExternalFileDrag(event)) {
    if (node.type !== 'folder') return
    event.preventDefault()
    event.stopPropagation()
    externalDragOverPath.value = null
    const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : []
    if (files.length > 0) openImportDialog(files, node.path)
    return
  }

  event.preventDefault()
  dragOverPath.value = null
  const dragging = dragState.value
  dragState.value = null
  if (!isValidDropTarget(dragging, node)) return
  await moveNode(dragging, node.path)
}

function onRootDragOver(event: DragEvent): void {
  if (!isExternalFileDrag(event)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  rootDragActive.value = true
}

function onRootDragLeave(event: DragEvent): void {
  if (!isExternalFileDrag(event)) return
  const container = event.currentTarget as HTMLElement
  const related = event.relatedTarget as Node | null
  if (related && container.contains(related)) return
  rootDragActive.value = false
}

async function onRootDrop(event: DragEvent): Promise<void> {
  if (!isExternalFileDrag(event)) return
  event.preventDefault()
  rootDragActive.value = false
  const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : []
  if (files.length > 0) openImportDialog(files, '')
}

function isDragOver(node: VaultTreeNode): boolean {
  return dragOverPath.value === node.path
}

function isDragging(node: VaultTreeNode): boolean {
  return dragState.value?.path === node.path
}

function isExternalDragOver(node: VaultTreeNode): boolean {
  return externalDragOverPath.value === node.path
}

function wasRecentlyImported(node: VaultTreeNode): boolean {
  return recentlyImported.value.has(node.path)
}
</script>

<template>
  <div v-if="isRoot" class="flex h-full select-none flex-col text-base text-content-primary touch-manipulation">
    <div class="flex items-center gap-2 border-b border-border p-2">
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition duration-150 hover:bg-accent/90 active:scale-95 focus:outline-none focus:ring-1 focus:ring-accent/50"
        title="Neue Notiz"
        @click="startCreate('create-file', vaultTree.selectedFolder)"
      >
        <FilePlus class="h-4 w-4 shrink-0" stroke-width="1.5" />
        Neue Notiz
      </button>

      <div class="ml-auto flex items-center gap-0.5">
        <button
          type="button"
          class="rounded-md p-2 text-content-secondary transition duration-150 hover:bg-white/[0.04] active:scale-95"
          title="Neuer Ordner"
          @click="startCreate('create-folder', vaultTree.selectedFolder)"
        >
          <FolderPlus class="h-4 w-4" stroke-width="1.5" />
        </button>
        <button
          type="button"
          class="rounded-md p-2 text-content-secondary transition duration-150 hover:bg-white/[0.04] active:scale-95"
          :title="sortTitle"
          @click="vaultSort.cycle()"
        >
          <ArrowUpDown class="h-4 w-4" stroke-width="1.5" />
        </button>

        <div class="relative">
          <button
            type="button"
            class="rounded-md p-2 text-content-secondary transition duration-150 hover:bg-white/[0.04] active:scale-95"
            title="Weitere Aktionen"
            @click="toggleOverflowMenu"
          >
            <MoreHorizontal class="h-4 w-4" stroke-width="1.5" />
          </button>

          <div v-if="showOverflowMenu || showTemplateMenu" class="fixed inset-0 z-40" @click="closeOverflowMenu" />

          <Transition
            enter-active-class="transition duration-150 ease-out"
            leave-active-class="transition duration-100 ease-in"
            enter-from-class="scale-95 opacity-0"
            leave-to-class="scale-95 opacity-0"
          >
            <div
              v-if="showOverflowMenu"
              class="absolute top-full right-0 z-50 mt-1 min-w-44 origin-top-right rounded-lg border border-border-strong bg-surface-1 py-1 text-content-primary shadow-float"
            >
              <button
                type="button"
                class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors duration-150 hover:bg-surface-2"
                @click="showOverflowMenu = false; openDailyNote()"
              >
                <Calendar class="h-4 w-4 shrink-0" stroke-width="1.5" />
                Tagesnotiz
              </button>
              <button
                type="button"
                class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors duration-150 hover:bg-surface-2"
                @click="openTemplateFromOverflow"
              >
                <LayoutTemplate class="h-4 w-4 shrink-0" stroke-width="1.5" />
                Neu aus Vorlage
              </button>
              <button
                type="button"
                class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors duration-150 hover:bg-surface-2"
                @click="triggerImportPicker(vaultTree.selectedFolder)"
              >
                <Upload class="h-4 w-4 shrink-0" stroke-width="1.5" />
                Importieren
              </button>
              <button
                type="button"
                class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors duration-150 hover:bg-surface-2"
                @click="showOverflowMenu = false; vaultTree.toggleExpandAll()"
              >
                <ChevronsDownUp v-if="vaultTree.allExpanded" class="h-4 w-4 shrink-0" stroke-width="1.5" />
                <ChevronsUpDown v-else class="h-4 w-4 shrink-0" stroke-width="1.5" />
                {{ vaultTree.allExpanded ? 'Alles einklappen' : 'Alles ausklappen' }}
              </button>
            </div>
          </Transition>

          <Transition
            enter-active-class="transition duration-150 ease-out"
            leave-active-class="transition duration-100 ease-in"
            enter-from-class="scale-95 opacity-0"
            leave-to-class="scale-95 opacity-0"
          >
            <div
              v-if="showTemplateMenu"
              class="absolute top-full right-0 z-50 mt-1 min-w-40 origin-top-right rounded-lg border border-border-strong bg-surface-1 py-1 text-content-primary shadow-float"
            >
              <p v-if="loadingTemplates" class="px-3.5 py-2 text-sm text-content-tertiary">
                Lädt…
              </p>
              <p v-else-if="templateOptions.length === 0" class="px-3.5 py-2 text-sm text-content-tertiary">
                Keine Vorlagen vorhanden
              </p>
              <button
                v-for="template in templateOptions"
                :key="template.path"
                type="button"
                class="flex w-full items-center px-3.5 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
                @click="pickTemplate(template)"
              >
                {{ template.name }}
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <div
      class="relative flex-1 overflow-y-auto overscroll-contain p-1"
      @dragover="onRootDragOver"
      @dragleave="onRootDragLeave"
      @drop="onRootDrop"
    >
      <Transition enter-active-class="transition duration-150 ease-out" leave-active-class="transition duration-100 ease-in" enter-from-class="opacity-0" leave-to-class="opacity-0">
        <div
          v-if="rootDragActive"
          class="pointer-events-none absolute inset-1 z-30 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-accent bg-surface-1/90 text-center"
        >
          <Upload class="h-6 w-6 text-accent" stroke-width="1.5" />
          <p class="text-sm font-medium text-content-primary">
            Dateien hier ablegen zum Importieren
          </p>
        </div>
      </Transition>

      <div v-if="vaultTree.loading" class="space-y-1 p-1">
        <div v-for="i in 8" :key="i" class="flex items-center gap-2 px-1.5 py-2">
          <div class="h-5 w-5 shrink-0 animate-pulse rounded bg-white/5" />
          <div class="h-4 animate-pulse rounded bg-white/5" :class="i % 3 === 0 ? 'w-20' : i % 2 === 0 ? 'w-32' : 'w-24'" />
        </div>
      </div>

      <p v-else-if="vaultTree.error" class="p-2 text-danger">
        {{ vaultTree.error }}
      </p>

      <div v-else-if="displayNodes.length === 0" class="flex flex-col items-center gap-2 px-4 py-12 text-center">
        <FolderPlus class="h-7 w-7 text-content-tertiary" stroke-width="1.5" />
        <p class="text-base text-content-tertiary">
          Dein Vault ist noch leer
        </p>
        <p class="mb-1 text-sm text-content-tertiary">
          Leg deine erste Notiz an, um loszulegen.
        </p>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm text-white transition duration-150 hover:bg-accent/90 active:scale-95 focus:outline-none focus:ring-1 focus:ring-accent/50"
          @click="startCreate('create-file', vaultTree.selectedFolder)"
        >
          <FilePlus class="h-4 w-4" stroke-width="1.5" />
          Neue Notiz erstellen
        </button>
      </div>

      <VaultTree v-else :nodes="displayNodes" parent-path="" />
    </div>

    <div v-if="contextMenu" class="fixed inset-0 z-40" @click="closeContextMenu" @contextmenu.prevent="closeContextMenu" />
    <Transition
      enter-active-class="transition duration-150 ease-out"
      leave-active-class="transition duration-100 ease-in"
      enter-from-class="scale-95 opacity-0"
      leave-to-class="scale-95 opacity-0"
    >
      <div
        v-if="contextMenu"
        class="fixed z-50 min-w-40 origin-top-left rounded-lg border border-border-strong bg-surface-1 py-1 text-content-primary shadow-float"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      >
        <button
          v-if="contextMenu.node.type === 'folder'"
          type="button"
          class="flex w-full items-center gap-2 px-3.5 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
          @click="startCreate('create-file', contextMenu.node.path)"
        >
          <FilePlus class="h-5 w-5 text-content-tertiary" stroke-width="1.5" />
          Neue Note hier
        </button>
        <button
          v-if="contextMenu.node.type === 'folder'"
          type="button"
          class="flex w-full items-center gap-2 px-3.5 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
          @click="startCreate('create-folder', contextMenu.node.path)"
        >
          <FolderPlus class="h-5 w-5 text-content-tertiary" stroke-width="1.5" />
          Neuer Unterordner
        </button>
        <button
          v-if="contextMenu.node.type === 'folder'"
          type="button"
          class="flex w-full items-center gap-2 px-3.5 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
          @click="triggerImportPicker(contextMenu.node.path)"
        >
          <Upload class="h-5 w-5 text-content-tertiary" stroke-width="1.5" />
          Dateien importieren…
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3.5 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
          @click="startRename(contextMenu.node)"
        >
          <Pencil class="h-5 w-5 text-content-tertiary" stroke-width="1.5" />
          Umbenennen
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3.5 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
          @click="openMoveDialog(contextMenu.node)"
        >
          <Move class="h-5 w-5 text-content-tertiary" stroke-width="1.5" />
          Verschieben nach…
        </button>
        <button
          v-if="contextMenu.node.type === 'file'"
          type="button"
          class="flex w-full items-center gap-2 px-3.5 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
          @click="archiveNode(contextMenu.node)"
        >
          <Archive class="h-5 w-5 text-content-tertiary" stroke-width="1.5" />
          Archivieren
        </button>
        <button
          v-if="contextMenu.node.type === 'file'"
          type="button"
          class="flex w-full items-center gap-2 px-3.5 py-2 text-left text-danger transition-colors duration-150 hover:bg-surface-2"
          @click="requestDelete(contextMenu.node)"
        >
          <Trash2 class="h-5 w-5" stroke-width="1.5" />
          Löschen
        </button>
      </div>
    </Transition>

    <ConfirmDialog
      v-if="pendingDelete"
      title="Löschen"
      :message="deleteConfirmMessage"
      confirm-label="Löschen"
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
    />

    <MoveToDialog
      v-if="moveDialogTarget"
      :node="moveDialogTarget"
      @confirm="confirmMove"
      @cancel="moveDialogTarget = null"
    />

    <ImportDialog />

    <input
      ref="importFileInputRef"
      type="file"
      multiple
      accept=".md,.markdown"
      class="hidden"
      @change="onImportInputChange"
    >
  </div>

  <ul v-else class="space-y-0.5">
    <li v-if="editState && editState.kind !== 'rename' && editState.parentPath === props.parentPath">
      <div class="flex items-center gap-2 rounded-md px-2.5 py-2">
        <span class="flex h-5 w-5 shrink-0 items-center justify-center text-content-tertiary">
          <Folder v-if="editState.kind === 'create-folder'" class="h-5 w-5" stroke-width="1.5" />
          <File v-else class="h-5 w-5" stroke-width="1.5" />
        </span>
        <TreeInlineInput
          :model-value="editState.value"
          :error="editState.error"
          @update:model-value="updateEditValue"
          @submit="submitEdit"
          @cancel="cancelEdit"
        />
      </div>
    </li>

    <li v-for="node in displayNodes" :key="node.path">
      <div
        v-if="editState?.kind === 'rename' && editState.node?.path === node.path"
        class="flex items-center gap-2 rounded-md px-2.5 py-2"
      >
        <span class="flex h-5 w-5 shrink-0 items-center justify-center text-content-tertiary">
          <ChevronRight
            v-if="node.type === 'folder'"
            class="h-5 w-5 transition-transform duration-150"
            :class="isExpanded(node) ? 'rotate-90' : ''"
            stroke-width="1.5"
          />
          <File v-else class="h-5 w-5" stroke-width="1.5" />
        </span>
        <TreeInlineInput
          :model-value="editState.value"
          :error="editState.error"
          @update:model-value="updateEditValue"
          @submit="submitEdit"
          @cancel="cancelEdit"
        />
      </div>

      <div
        v-else
        role="button"
        tabindex="0"
        draggable="true"
        class="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors duration-150 active:bg-white/[0.06]"
        :class="[
          tabs.activePath === node.path || (node.type === 'folder' && vaultTree.selectedFolder === node.path) ? 'bg-surface-2 font-medium text-content-primary' : 'text-content-secondary hover:bg-white/[0.04] hover:text-content-primary',
          isDragOver(node) ? 'border border-accent/50 bg-surface-2' : '',
          isDragging(node) ? 'opacity-50' : '',
          isExternalDragOver(node) ? 'border border-dashed border-accent bg-surface-2' : '',
          wasRecentlyImported(node) ? 'bg-accent/20' : ''
        ]"
        @click="onNodeClick(node)"
        @keydown.enter.prevent="onNodeClick(node)"
        @keydown.space.prevent="onNodeClick(node)"
        @contextmenu="onContextMenu($event, node)"
        @dragstart="onDragStart($event, node)"
        @dragend="onDragEnd"
        @dragover="onDragOver($event, node)"
        @dragleave="onDragLeave($event, node)"
        @drop="onDrop($event, node)"
      >
        <span class="flex shrink-0 items-center gap-0.5">
          <ChevronRight
            v-if="node.type === 'folder'"
            class="h-4 w-4 text-content-tertiary transition-transform duration-150"
            :class="isExpanded(node) ? 'rotate-90' : ''"
            stroke-width="1.5"
          />
          <span v-else class="inline-block h-4 w-4" />
          <component
            :is="nodeIcon(node)"
            class="h-5 w-5"
            :class="node.type === 'folder' ? folderIconColor(node.path) : 'text-content-tertiary'"
            stroke-width="1.5"
          />
        </span>
        <span class="flex-1 truncate">{{ node.name }}</span>
        <button
          v-if="node.type === 'file'"
          type="button"
          class="shrink-0 rounded-md p-1 transition duration-150 active:scale-90"
          :class="isFavorite(node.path) ? 'text-accent' : 'text-content-tertiary hover:text-accent'"
          :title="isFavorite(node.path) ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'"
          @click.stop="toggleFavorite(node.path)"
        >
          <Star class="h-4 w-4" stroke-width="1.5" :fill="isFavorite(node.path) ? 'currentColor' : 'none'" />
        </button>
      </div>

      <Transition
        enter-active-class="grid transition-all duration-150 ease-out"
        leave-active-class="grid transition-all duration-150 ease-out"
        enter-from-class="grid-rows-collapsed"
        enter-to-class="grid-rows-expanded"
        leave-from-class="grid-rows-expanded"
        leave-to-class="grid-rows-collapsed"
      >
        <div v-if="node.type === 'folder' && isExpanded(node)" class="ml-3 border-l border-border pl-1">
          <div class="overflow-hidden">
            <VaultTree :nodes="node.children ?? []" :parent-path="node.path" />
          </div>
        </div>
      </Transition>
    </li>
  </ul>
</template>
