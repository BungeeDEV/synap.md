<script setup lang="ts">
import { ArrowUpDown, Calendar, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, File, FilePlus, Folder, FolderPlus, LayoutTemplate, Move, Pencil, Trash2 } from 'lucide-vue-next'
import type { VaultTreeNode } from '~/stores/vaultTree'
import { sortVaultTree, VAULT_SORT_LABELS } from '~/utils/sortVaultTree'
import { validateRawName } from '~/utils/validateFileName'
import { isValidMoveTarget, parentFolderOf } from '~/utils/vaultMove'

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

interface TreeEditState {
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

function pickTemplate(template: TemplateOption): void {
  showTemplateMenu.value = false
  const parentPath = vaultTree.selectedFolder
  if (parentPath) vaultTree.expand(parentPath)
  editState.value = { kind: 'create-file', parentPath, value: 'Untitled', error: null, templateName: template.name }
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

function isValidDropTarget(dragging: DragDescriptor | null, target: VaultTreeNode): boolean {
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

function onDragOver(event: DragEvent, node: VaultTreeNode): void {
  if (!isValidDropTarget(dragState.value, node)) {
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'
    return
  }
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  dragOverPath.value = node.path
}

function onDragLeave(node: VaultTreeNode): void {
  if (dragOverPath.value === node.path) dragOverPath.value = null
}

async function onDrop(event: DragEvent, node: VaultTreeNode): Promise<void> {
  event.preventDefault()
  dragOverPath.value = null
  const dragging = dragState.value
  dragState.value = null
  if (!isValidDropTarget(dragging, node)) return
  await moveNode(dragging, node.path)
}

function isDragOver(node: VaultTreeNode): boolean {
  return dragOverPath.value === node.path
}

function isDragging(node: VaultTreeNode): boolean {
  return dragState.value?.path === node.path
}
</script>

<template>
  <div v-if="isRoot" class="flex h-full select-none flex-col text-sm text-content-primary touch-manipulation">
    <div class="flex items-center gap-1 border-b border-border p-2">
      <button
        type="button"
        class="rounded-md p-2.5 text-content-secondary transition-colors duration-150 hover:bg-white/[0.04] md:p-1.5"
        title="Neue Datei"
        @click="startCreate('create-file', vaultTree.selectedFolder)"
      >
        <FilePlus class="h-4 w-4" stroke-width="1.5" />
      </button>
      <button
        type="button"
        class="rounded-md p-2.5 text-content-secondary transition-colors duration-150 hover:bg-white/[0.04] md:p-1.5"
        title="Neuer Ordner"
        @click="startCreate('create-folder', vaultTree.selectedFolder)"
      >
        <FolderPlus class="h-4 w-4" stroke-width="1.5" />
      </button>
      <button
        type="button"
        class="rounded-md p-2.5 text-content-secondary transition-colors duration-150 hover:bg-white/[0.04] md:p-1.5"
        title="Heutige Note öffnen"
        @click="openDailyNote"
      >
        <Calendar class="h-4 w-4" stroke-width="1.5" />
      </button>
      <div class="relative">
        <button
          type="button"
          class="rounded-md p-2.5 text-content-secondary transition-colors duration-150 hover:bg-white/[0.04] md:p-1.5"
          title="Neu aus Vorlage"
          @click="toggleTemplateMenu"
        >
          <LayoutTemplate class="h-4 w-4" stroke-width="1.5" />
        </button>

        <template v-if="showTemplateMenu">
          <div class="fixed inset-0 z-40" @click="closeTemplateMenu" />
          <div class="absolute top-full left-0 z-50 mt-1 min-w-40 rounded-lg border border-border-strong bg-surface-1 py-1 text-content-primary shadow-float">
            <p v-if="loadingTemplates" class="px-3 py-1.5 text-xs text-content-tertiary">
              Lädt…
            </p>
            <p v-else-if="templateOptions.length === 0" class="px-3 py-1.5 text-xs text-content-tertiary">
              Keine Vorlagen vorhanden
            </p>
            <button
              v-for="template in templateOptions"
              :key="template.path"
              type="button"
              class="flex w-full items-center px-3 py-1.5 text-left transition-colors duration-150 hover:bg-surface-2"
              @click="pickTemplate(template)"
            >
              {{ template.name }}
            </button>
          </div>
        </template>
      </div>
      <button
        type="button"
        class="rounded-md p-2.5 text-content-secondary transition-colors duration-150 hover:bg-white/[0.04] md:p-1.5"
        :title="sortTitle"
        @click="vaultSort.cycle()"
      >
        <ArrowUpDown class="h-4 w-4" stroke-width="1.5" />
      </button>
      <button
        type="button"
        class="ml-auto rounded-md p-2.5 text-content-secondary transition-colors duration-150 hover:bg-white/[0.04] md:p-1.5"
        :title="vaultTree.allExpanded ? 'Alles einklappen' : 'Alles ausklappen'"
        @click="vaultTree.toggleExpandAll()"
      >
        <ChevronsDownUp v-if="vaultTree.allExpanded" class="h-4 w-4" stroke-width="1.5" />
        <ChevronsUpDown v-else class="h-4 w-4" stroke-width="1.5" />
      </button>
    </div>

    <p v-if="vaultTree.loading" class="p-2 text-content-tertiary">
      Lädt…
    </p>
    <p v-else-if="vaultTree.error" class="p-2 text-danger">
      {{ vaultTree.error }}
    </p>

    <div class="flex-1 overflow-y-auto overscroll-contain p-1">
      <VaultTree :nodes="displayNodes" parent-path="" />
    </div>

    <template v-if="contextMenu">
      <div class="fixed inset-0 z-40" @click="closeContextMenu" @contextmenu.prevent="closeContextMenu" />
      <div
        class="fixed z-50 min-w-40 rounded-lg border border-border-strong bg-surface-1 py-1 text-content-primary shadow-float"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      >
        <button
          v-if="contextMenu.node.type === 'folder'"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors duration-150 hover:bg-surface-2"
          @click="startCreate('create-file', contextMenu.node.path)"
        >
          <FilePlus class="h-4 w-4 text-content-tertiary" stroke-width="1.5" />
          Neue Note hier
        </button>
        <button
          v-if="contextMenu.node.type === 'folder'"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors duration-150 hover:bg-surface-2"
          @click="startCreate('create-folder', contextMenu.node.path)"
        >
          <FolderPlus class="h-4 w-4 text-content-tertiary" stroke-width="1.5" />
          Neuer Unterordner
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors duration-150 hover:bg-surface-2"
          @click="startRename(contextMenu.node)"
        >
          <Pencil class="h-4 w-4 text-content-tertiary" stroke-width="1.5" />
          Umbenennen
        </button>
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors duration-150 hover:bg-surface-2"
          @click="openMoveDialog(contextMenu.node)"
        >
          <Move class="h-4 w-4 text-content-tertiary" stroke-width="1.5" />
          Verschieben nach…
        </button>
        <button
          v-if="contextMenu.node.type === 'file'"
          type="button"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-danger transition-colors duration-150 hover:bg-surface-2"
          @click="requestDelete(contextMenu.node)"
        >
          <Trash2 class="h-4 w-4" stroke-width="1.5" />
          Löschen
        </button>
      </div>
    </template>

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
  </div>

  <ul v-else class="space-y-0.5">
    <li v-if="editState && editState.kind !== 'rename' && editState.parentPath === props.parentPath">
      <div class="flex items-center gap-1.5 rounded-md px-2 py-1.5">
        <span class="flex h-4 w-4 shrink-0 items-center justify-center text-content-tertiary">
          <Folder v-if="editState.kind === 'create-folder'" class="h-4 w-4" stroke-width="1.5" />
          <File v-else class="h-4 w-4" stroke-width="1.5" />
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
        class="flex items-center gap-1.5 rounded-md px-2 py-1.5"
      >
        <span class="flex h-4 w-4 shrink-0 items-center justify-center text-content-tertiary">
          <template v-if="node.type === 'folder'">
            <ChevronDown v-if="isExpanded(node)" class="h-4 w-4" stroke-width="1.5" />
            <ChevronRight v-else class="h-4 w-4" stroke-width="1.5" />
          </template>
          <File v-else class="h-4 w-4" stroke-width="1.5" />
        </span>
        <TreeInlineInput
          :model-value="editState.value"
          :error="editState.error"
          @update:model-value="updateEditValue"
          @submit="submitEdit"
          @cancel="cancelEdit"
        />
      </div>

      <button
        v-else
        type="button"
        draggable="true"
        class="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors duration-150"
        :class="[
          tabs.activePath === node.path || (node.type === 'folder' && vaultTree.selectedFolder === node.path) ? 'bg-surface-2 text-content-primary' : 'text-content-secondary hover:bg-white/[0.04] hover:text-content-primary',
          isDragOver(node) ? 'border border-accent/50 bg-surface-2' : '',
          isDragging(node) ? 'opacity-50' : ''
        ]"
        @click="onNodeClick(node)"
        @contextmenu="onContextMenu($event, node)"
        @dragstart="onDragStart($event, node)"
        @dragend="onDragEnd"
        @dragover="onDragOver($event, node)"
        @dragleave="onDragLeave(node)"
        @drop="onDrop($event, node)"
      >
        <span class="flex h-4 w-4 shrink-0 items-center justify-center text-content-tertiary">
          <template v-if="node.type === 'folder'">
            <ChevronDown v-if="isExpanded(node)" class="h-4 w-4" stroke-width="1.5" />
            <ChevronRight v-else class="h-4 w-4" stroke-width="1.5" />
          </template>
          <File v-else class="h-4 w-4" stroke-width="1.5" />
        </span>
        <span>{{ node.name }}</span>
      </button>

      <div v-if="node.type === 'folder' && isExpanded(node)" class="ml-3 border-l border-border pl-1">
        <VaultTree :nodes="node.children ?? []" :parent-path="node.path" />
      </div>
    </li>
  </ul>
</template>
