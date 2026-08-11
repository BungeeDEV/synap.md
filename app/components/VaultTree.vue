<script setup lang="ts">
import { Archive, ArrowUpDown, BarChart3, Calendar, ChevronRight, ChevronsDownUp, ChevronsUpDown, Copy, Download, ExternalLink, File, FileDown, FilePlus, Folder, FolderOpen, FolderPlus, Info, LayoutTemplate, Link2, MoreHorizontal, Move, Palette, Pencil, Printer, Star, Trash2, Upload } from 'lucide-vue-next'
import type { VaultTreeNode } from '~/stores/vaultTree'
import { titleFromPath } from '~/stores/tabs'
import { sortVaultTree, VAULT_SORT_LABELS } from '~/utils/sortVaultTree'
import { validateRawName } from '#shared/validateFileName'
import { isValidMoveTarget, parentFolderOf } from '~/utils/vaultMove'
import { FOLDER_COLOR_OPTIONS, folderColorTextClass } from '~/utils/folderColors'
import { printHtmlDocument } from '~/utils/printHtmlDocument'
import type { ContextMenuGroup } from '~/utils/contextMenuTypes'
import { vibrateShort } from '~/utils/haptics'
import {
  ACTION_BUTTON_PX,
  LONG_PRESS_MS,
  clampSwipeOffset,
  exceedsMoveCancel,
  lockedDirection,
  resolveSwipeOutcome,
  revealSideOf,
  type SwipeState
} from '~/utils/rowGestures'

const { isFavorite, toggleFavorite } = useFavorites()
const { colorKeyOf, setFolderColor } = useFolderColors()
const { openImportDialog, recentlyImported } = useVaultImport()
const { isMobile } = useIsMobile()
const toast = useToast()

const props = withDefaults(defineProps<{ nodes?: VaultTreeNode[] | null, parentPath?: string }>(), { nodes: null, parentPath: '' })

const isRoot = props.nodes === null
const vaultTree = useVaultTreeStore()
const tabs = useTabsStore()
const vaultSort = useVaultSort()
const mobileNav = useMobileNavStore()

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
// ref here would be local per-instance, so a right-click (or, on touch, a
// long-press) on a node rendered by a nested (non-root) instance would
// never reach the root's menu overlay. `initialSubmenu` lets a swipe-
// revealed action (e.g. a folder's "Verschieben nach…") open the menu
// straight into that submenu instead of the top-level group list.
const contextMenu = useState<{ node: VaultTreeNode, x: number, y: number, initialSubmenu?: string } | null>('vaultTreeContextMenu', () => null)
const pendingDelete = useState<VaultTreeNode | null>('vaultTreePendingDelete', () => null)
const detailsTarget = useState<VaultTreeNode | null>('vaultTreeDetailsTarget', () => null)

// Single source of truth for "which sidebar dropdown/menu is open" - shared
// with VaultSidebar.vue's workspace menu via the same useState key. Only one
// of these (plus the separate contextMenu above) can ever be open: every
// open path below clears this, and every path that opens one of these three
// clears contextMenu too. Without this, e.g. right-clicking a row while
// "Weitere Aktionen" was open used to leave both visible at once.
const activeTreeMenu = useState<'overflow' | 'template' | 'workspace' | null>('vaultActiveTreeMenu', () => null)

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
  onMounted(() => {
    void vaultTree.refresh()
    document.addEventListener('pointerdown', onDocumentPointerDownCapture, { capture: true })
  })
  onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDownCapture, { capture: true }))
}

function isExpanded(node: VaultTreeNode): boolean {
  return vaultTree.isExpanded(node.path)
}

// Hashed by path (not name) so same-named folders in different parents don't
// collide, and a folder keeps its color across sibling reordering/sorting -
// unless the user picked an explicit override via "Farbe ändern"
// (useFolderColors), which then wins. See utils/folderColors.ts.
function folderIconColor(path: string): string {
  // Only apply a color when the user has explicitly set one; default folders
  // get a neutral icon so the sidebar stays visually quiet.
  const override = colorKeyOf(path)
  return override ? folderColorTextClass(path, override) : 'text-content-tertiary/70'
}

function nodeIcon(node: VaultTreeNode): typeof File | typeof Folder | typeof FolderOpen {
  if (node.type === 'file') return File
  return isExpanded(node) ? FolderOpen : Folder
}

function onNodeClick(node: VaultTreeNode): void {
  // A long-press already opened the context menu - the browser still fires
  // a plain `click` right after, which must not also navigate into the note.
  if (suppressNextRowClick) {
    suppressNextRowClick = false
    return
  }

  // A tap while a swipe action is revealed closes the reveal instead of
  // navigating - same convention as Gmail/Apple Mail's swipe rows.
  const swipe = rowSwipeState.value[node.path]
  if (swipe?.revealed) {
    rowSwipeState.value[node.path] = { offsetX: 0, revealed: null }
    return
  }

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
  activeTreeMenu.value = null
  contextMenu.value = { node, x: event.clientX, y: event.clientY }
}

function closeContextMenu(): void {
  contextMenu.value = null
  activeTreeMenu.value = null
}

// --- Long-press (opens the context menu, touch/pen only) + horizontal
// swipe (quick actions, touch/pen/mouse) on the same row. Both start from
// pointerdown and are told apart by how/how-long the pointer moves - see
// app/utils/rowGestures.ts for the pure threshold/outcome logic.
//
// Mouse gets its own hold-to-arm gate (see swipeArmed/armMouseSwipe below):
// a plain click must keep opening the note, only holding the mouse button
// past LONG_PRESS_MS - the same duration and the same timer field the
// touch long-press already uses, just with a different callback - arms
// swipe tracking so a subsequent drag can reveal the action zones. Desktop
// right-click still owns the context menu, untouched by any of this.

// Shared across every recursive VaultTree instance via useState (same
// reasoning as contextMenu above) - needed so the document-level dismiss
// listener below (registered once, root-only) can close a reveal left open
// on a row rendered by any nested instance, not just its own.
const rowSwipeState = useState<Record<string, SwipeState>>('vaultTreeRowSwipeState', () => ({}))

interface ActiveRowGesture {
  path: string
  startX: number
  startY: number
  startTime: number
  direction: 'horizontal' | 'vertical' | null
  longPressTimer: ReturnType<typeof setTimeout> | null
  // Touch/pen: true from the start - the swipe already tracks the finger
  // immediately, same as always. Mouse: false until armMouseSwipe() fires
  // (see onRowPointerDown) - onRowPointerMove ignores all movement until
  // then, so a plain quick click/release never touches rowSwipeState and
  // falls through to the native `click` (open note) untouched.
  swipeArmed: boolean
}

let activeRowGesture: ActiveRowGesture | null = null
// Set right when a long-press fires, consumed by the very next onNodeClick -
// the browser still dispatches a normal `click` after pointerup even though
// nothing here called preventDefault at press time (there's no live event
// to prevent 500ms later inside the setTimeout callback), so this is what
// stops that click from also navigating into the note.
let suppressNextRowClick = false

function resetRowSwipe(path: string): void {
  rowSwipeState.value[path] = { offsetX: 0, revealed: null }
}

// Dismisses every *other* revealed row - mirrors Gmail/Apple Mail: starting
// a new interaction anywhere outside an open swipe row closes it, instead of
// leaving it revealed (and visually sitting on top of its row) until that
// exact row is tapped again. Registered as a capture-phase document listener
// (root instance only, see onMounted below) so it fires before the target
// row's own pointerdown/click handling.
function closeOtherRowSwipes(exceptPath: string | null): void {
  for (const [path, state] of Object.entries(rowSwipeState.value)) {
    if (path !== exceptPath && state.revealed) rowSwipeState.value[path] = { offsetX: 0, revealed: null }
  }
}

function onDocumentPointerDownCapture(event: PointerEvent): void {
  const target = event.target as HTMLElement | null
  const rowPath = target?.closest('[data-row-path]')?.getAttribute('data-row-path') ?? null
  closeOtherRowSwipes(rowPath)
}

/**
 * Pixel width of the zone being swiped open on `node` for the given side -
 * the left zone (side 'right', see revealSideOf) is always the single
 * Favorisieren button; the right zone (side 'left') is Archivieren+Löschen
 * (2 buttons) for files or just Verschieben (1 button) for folders. Used to
 * scale both the drag clamp and the reveal/fling thresholds so a
 * two-button zone actually needs twice the drag distance of a one-button
 * zone, instead of both snapping to (and clamping around) the same fixed
 * width regardless of how many buttons are actually in it.
 */
function revealWidthFor(node: VaultTreeNode, side: 'left' | 'right' | null): number {
  if (side === 'left' && node.type === 'file') return ACTION_BUTTON_PX * 2
  return ACTION_BUTTON_PX
}

function fireLongPress(node: VaultTreeNode, x: number, y: number): void {
  if (!activeRowGesture || activeRowGesture.path !== node.path || activeRowGesture.direction === 'vertical') return
  activeRowGesture.longPressTimer = null
  suppressNextRowClick = true
  vibrateShort()
  activeTreeMenu.value = null
  contextMenu.value = { node, x, y }
}

// Desktop-mouse equivalent of fireLongPress above: fires from the exact
// same LONG_PRESS_MS timer started in onRowPointerDown, just with a
// different outcome - arms swipe tracking instead of opening the context
// menu (right-click still owns the context menu on desktop). Below this
// hold duration, onRowPointerMove ignores mouse movement entirely, so a
// plain click/drag-release stays a plain click.
function armMouseSwipe(node: VaultTreeNode): void {
  if (!activeRowGesture || activeRowGesture.path !== node.path) return
  activeRowGesture.longPressTimer = null
  activeRowGesture.swipeArmed = true
}

function runSwipeFlingAction(node: VaultTreeNode, side: 'left' | 'right' | null): void {
  if (side === 'right') {
    void toggleFavorite(node.path)
  } else if (side === 'left' && node.type === 'file') {
    void archiveNode(node)
  }
  // Folders' swipe-left action ("Verschieben nach…") needs a destination -
  // never fling-executed, only revealed (see onRowPointerUp below).
}

function onRowPointerDown(event: PointerEvent, node: VaultTreeNode): void {
  if (event.pointerType !== 'touch' && event.pointerType !== 'pen' && event.pointerType !== 'mouse') return
  if (activeRowGesture?.longPressTimer) clearTimeout(activeRowGesture.longPressTimer)

  const isMouse = event.pointerType === 'mouse'
  activeRowGesture = {
    path: node.path,
    startX: event.clientX,
    startY: event.clientY,
    startTime: Date.now(),
    direction: null,
    swipeArmed: !isMouse,
    longPressTimer: setTimeout(
      () => (isMouse ? armMouseSwipe(node) : fireLongPress(node, event.clientX, event.clientY)),
      LONG_PRESS_MS
    )
  }
}

// Only reactive piece of gesture tracking - drives whether the row's
// transform gets a CSS transition (snap animation once released) or not
// (must track the finger 1:1 with zero lag while actively dragging).
// `activeRowGesture` itself is deliberately a plain, non-reactive variable
// (it's internal bookkeeping the template never reads), so this is the one
// bit that needs to be a ref.
const draggingPath = ref<string | null>(null)

function onRowPointerMove(event: PointerEvent, node: VaultTreeNode): void {
  const gesture = activeRowGesture
  if (!gesture || gesture.path !== node.path) return
  // Mouse, still within the hold threshold: ignore movement entirely so a
  // plain click/drag-release never starts tracking a swipe (see
  // armMouseSwipe). Touch/pen are always armed and reach this line as before.
  if (!gesture.swipeArmed) return

  const dx = event.clientX - gesture.startX
  const dy = event.clientY - gesture.startY

  if (gesture.direction === null) {
    if (exceedsMoveCancel(dx, dy) && gesture.longPressTimer) {
      clearTimeout(gesture.longPressTimer)
      gesture.longPressTimer = null
    }
    gesture.direction = lockedDirection(dx, dy)
    if (gesture.direction === 'horizontal') draggingPath.value = node.path
    if (gesture.direction === null) return
  }

  // Vertical: this is a scroll, not a swipe - don't preventDefault, let the
  // browser handle it natively (this is the "must not fight scrolling" guard).
  if (gesture.direction === 'vertical') return

  event.preventDefault()
  const offsetX = clampSwipeOffset(dx, revealWidthFor(node, revealSideOf(dx)))
  rowSwipeState.value[node.path] = { offsetX, revealed: revealSideOf(offsetX) }
}

function onRowPointerUp(event: PointerEvent, node: VaultTreeNode): void {
  const gesture = activeRowGesture
  activeRowGesture = null
  draggingPath.value = null
  if (!gesture || gesture.path !== node.path) return
  if (gesture.longPressTimer) clearTimeout(gesture.longPressTimer)

  if (gesture.direction !== 'horizontal') return

  const state = rowSwipeState.value[node.path] ?? { offsetX: 0, revealed: null }
  const side = revealSideOf(state.offsetX)
  const revealWidth = revealWidthFor(node, side)
  const outcome = resolveSwipeOutcome(state.offsetX, Date.now() - gesture.startTime, revealWidth)

  if (outcome === 'snap-back') {
    resetRowSwipe(node.path)
  } else if (outcome === 'reveal' || (outcome === 'fling' && side === 'left' && node.type === 'folder')) {
    rowSwipeState.value[node.path] = { offsetX: side === 'left' ? -revealWidth : revealWidth, revealed: side }
  } else {
    resetRowSwipe(node.path)
    runSwipeFlingAction(node, side)
  }
}

function onRowPointerCancel(node: VaultTreeNode): void {
  if (activeRowGesture?.longPressTimer) clearTimeout(activeRowGesture.longPressTimer)
  activeRowGesture = null
  draggingPath.value = null
  resetRowSwipe(node.path)
}

function swipeOffsetOf(node: VaultTreeNode): number {
  return rowSwipeState.value[node.path]?.offsetX ?? 0
}

function swipeRevealedOf(node: VaultTreeNode): 'left' | 'right' | null {
  return rowSwipeState.value[node.path]?.revealed ?? null
}

/**
 * Also used to hide the row's own inline favorite-star button while a swipe
 * is active: it doesn't move with the reveal (it's part of the translating
 * row content, not the strip underneath), so once the row shifts far enough
 * it visually lands on top of the revealed Archive/Delete buttons - hiding
 * it for the duration of any non-zero offset avoids that overlap entirely,
 * regardless of exact reveal width.
 */

/** Opens the context menu straight into the move submenu - used by a folder's swipe-revealed "Verschieben nach…" button, which has no room for a full menu. */
function openMoveFromSwipe(node: VaultTreeNode, event: MouseEvent): void {
  resetRowSwipe(node.path)
  activeTreeMenu.value = null
  contextMenu.value = { node, x: event.clientX, y: event.clientY, initialSubmenu: 'move' }
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

async function selectMoveTarget(node: VaultTreeNode, targetFolderPath: string): Promise<void> {
  await moveNode({ path: node.path, type: node.type }, targetFolderPath)
}

// --- New context-menu actions ---

async function openInNewTab(node: VaultTreeNode): Promise<void> {
  closeContextMenu()
  await tabs.openTab(node.path, { activate: false })
  toast.show(`"${node.name}" in neuem Tab geöffnet`)
}

async function duplicateNode(node: VaultTreeNode): Promise<void> {
  closeContextMenu()
  try {
    const response = await $fetch<{ path: string }>('/api/vault/duplicate', { method: 'POST', body: { path: node.path } })
    await vaultTree.refresh()
    await tabs.openTab(response.path)
    toast.show(`"${node.name}" dupliziert`)
  } catch (err) {
    toast.show(errorMessageOf(err, 'Duplizieren fehlgeschlagen'), 'error')
  }
}

async function copyInternalLink(node: VaultTreeNode): Promise<void> {
  closeContextMenu()
  await navigator.clipboard.writeText(`[[${titleFromPath(node.path)}]]`)
  toast.show('Interner Link kopiert')
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function exportAsMarkdown(node: VaultTreeNode): Promise<void> {
  closeContextMenu()
  try {
    const file = await $fetch<{ raw: string }>('/api/vault/file', { query: { path: node.path } })
    triggerBlobDownload(new Blob([file.raw], { type: 'text/markdown' }), node.name)
  } catch {
    toast.show('Export fehlgeschlagen', 'error')
  }
}

async function printNote(node: VaultTreeNode): Promise<void> {
  closeContextMenu()
  try {
    const response = await $fetch<{ html: string }>('/api/vault/render', { query: { path: node.path } })
    printHtmlDocument(titleFromPath(node.path), response.html)
  } catch {
    toast.show('Drucken fehlgeschlagen', 'error')
  }
}

function openDetails(node: VaultTreeNode): void {
  closeContextMenu()
  detailsTarget.value = node
}

function exportFolderZip(node: VaultTreeNode): void {
  closeContextMenu()
  const link = document.createElement('a')
  link.href = `/api/settings/export?path=${encodeURIComponent(node.path)}`
  link.click()
}

// --- Declarative context-menu item groups (primary / organize / destructive) ---

function fileMenuGroups(node: VaultTreeNode): ContextMenuGroup[] {
  return [
    [
      { id: 'open-new-tab', label: 'Öffnen in neuem Tab', icon: ExternalLink, onSelect: () => openInNewTab(node) },
      { id: 'rename', label: 'Umbenennen', icon: Pencil, onSelect: () => startRename(node) },
      { id: 'favorite', label: isFavorite(node.path) ? 'Favorit entfernen' : 'Favorisieren', icon: Star, onSelect: () => toggleFavorite(node.path) }
    ],
    [
      { id: 'duplicate', label: 'Duplizieren', icon: Copy, onSelect: () => duplicateNode(node) },
      { id: 'move', label: 'Verschieben nach…', icon: Move, submenu: 'move' },
      { id: 'copy-link', label: 'Internen Link kopieren', icon: Link2, onSelect: () => copyInternalLink(node) },
      { id: 'export', label: 'Exportieren', icon: Download, submenu: 'export' },
      { id: 'details', label: 'Details anzeigen', icon: Info, onSelect: () => openDetails(node) }
    ],
    [
      { id: 'archive', label: 'Archivieren', icon: Archive, onSelect: () => archiveNode(node) },
      { id: 'delete', label: 'Löschen', icon: Trash2, danger: true, onSelect: () => requestDelete(node) }
    ]
  ]
}

function folderMenuGroups(node: VaultTreeNode): ContextMenuGroup[] {
  return [
    [
      { id: 'new-file', label: 'Neue Note hier', icon: FilePlus, onSelect: () => startCreate('create-file', node.path) },
      { id: 'new-folder', label: 'Neuer Unterordner', icon: FolderPlus, onSelect: () => startCreate('create-folder', node.path) },
      { id: 'import', label: 'Dateien importieren…', icon: Upload, onSelect: () => triggerImportPicker(node.path) },
      { id: 'favorite', label: isFavorite(node.path) ? 'Favorit entfernen' : 'Favorisieren', icon: Star, onSelect: () => toggleFavorite(node.path) }
    ],
    [
      { id: 'rename', label: 'Umbenennen', icon: Pencil, onSelect: () => startRename(node) },
      { id: 'move', label: 'Verschieben nach…', icon: Move, submenu: 'move' },
      { id: 'export-zip', label: 'Exportieren als ZIP', icon: Download, onSelect: () => exportFolderZip(node) },
      { id: 'stats', label: 'Ordner-Statistik', icon: BarChart3, onSelect: () => openDetails(node) },
      { id: 'color', label: 'Farbe ändern', icon: Palette, submenu: 'color' }
    ]
  ]
}

const contextMenuGroups = computed<ContextMenuGroup[]>(() => {
  const node = contextMenu.value?.node
  if (!node) return []
  return node.type === 'file' ? fileMenuGroups(node) : folderMenuGroups(node)
})

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
  if (parentPath) vaultTree.expand(parentPath)
  editState.value = { kind, parentPath, value: 'Untitled', error: null }
}

function startRename(node: VaultTreeNode): void {
  closeContextMenu()
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

const templateOptions = ref<TemplateOption[]>([])
const loadingTemplates = ref(false)
const showTemplateMenu = computed(() => activeTreeMenu.value === 'template')
const showOverflowMenu = computed(() => activeTreeMenu.value === 'overflow')

async function toggleTemplateMenu(): Promise<void> {
  contextMenu.value = null
  const opening = activeTreeMenu.value !== 'template'
  activeTreeMenu.value = opening ? 'template' : null
  if (!opening || templateOptions.value.length > 0) return

  loadingTemplates.value = true
  try {
    templateOptions.value = await $fetch<TemplateOption[]>('/api/templates/list')
  } finally {
    loadingTemplates.value = false
  }
}

function closeTemplateMenu(): void {
  if (activeTreeMenu.value === 'template') activeTreeMenu.value = null
}

function toggleOverflowMenu(): void {
  contextMenu.value = null
  activeTreeMenu.value = activeTreeMenu.value === 'overflow' ? null : 'overflow'
}

// Also dismisses the template menu - this backs the shared click-outside
// catcher below, which covers both (`v-if="showOverflowMenu || showTemplateMenu"`).
function closeOverflowMenu(): void {
  activeTreeMenu.value = null
}

function openTemplateFromOverflow(): void {
  void toggleTemplateMenu()
}

function pickTemplate(template: TemplateOption): void {
  closeTemplateMenu()
  const parentPath = vaultTree.selectedFolder
  if (parentPath) vaultTree.expand(parentPath)
  editState.value = { kind: 'create-file', parentPath, value: 'Untitled', error: null, templateName: template.name }
}

// --- Import .md files from the OS (native file picker) ---

const importFileInputRef = ref<HTMLInputElement | null>(null)
const importPickerTargetFolder = ref('')

function triggerImportPicker(targetFolder: string): void {
  closeContextMenu()
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
        class="flex items-center gap-1.5 rounded-md border border-white/[0.08] px-2.5 py-1.5 text-sm text-content-secondary transition duration-150 hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-content-primary active:scale-95 focus:outline-none"
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

          <!-- Teleported: this click-outside catcher would otherwise inherit
               VaultSidebar's <aside> as its containing block (see
               ContextMenu.vue's Teleport comment) and only cover the 320px
               sidebar column, leaving clicks in the main content area unable
               to dismiss this menu. -->
          <Teleport to="body">
            <div v-if="showOverflowMenu || showTemplateMenu" class="fixed inset-0 z-40" @click="closeOverflowMenu" />
          </Teleport>

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
                @click="closeOverflowMenu(); openDailyNote()"
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
                @click="closeOverflowMenu(); vaultTree.toggleExpandAll()"
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

    <ContextMenu
      :open="!!contextMenu"
      :x="contextMenu?.x ?? 0"
      :y="contextMenu?.y ?? 0"
      :groups="contextMenuGroups"
      :initial-submenu="contextMenu?.initialSubmenu"
      @close="closeContextMenu"
    >
      <template #move="{ close }">
        <ContextMenuMoveSubmenu
          v-if="contextMenu"
          :node="contextMenu.node"
          @select="(target) => { selectMoveTarget(contextMenu!.node, target); close() }"
        />
      </template>
      <template #export="{ close }">
        <div class="w-48 p-1">
          <button
            type="button"
            class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-content-secondary transition-colors duration-150 hover:bg-white/[0.04] hover:text-content-primary focus-visible:outline-none"
            @click="contextMenu && exportAsMarkdown(contextMenu.node); close()"
          >
            <FileDown class="h-4 w-4 shrink-0 text-content-tertiary" stroke-width="1.5" />
            Als Markdown
          </button>
          <button
            type="button"
            class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-content-secondary transition-colors duration-150 hover:bg-white/[0.04] hover:text-content-primary focus-visible:outline-none"
            @click="contextMenu && printNote(contextMenu.node); close()"
          >
            <Printer class="h-4 w-4 shrink-0 text-content-tertiary" stroke-width="1.5" />
            Drucken / Als PDF
          </button>
        </div>
      </template>
      <template #color="{ close }">
        <div class="w-44 p-2">
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="option in FOLDER_COLOR_OPTIONS"
              :key="option.key"
              type="button"
              class="flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/50"
              :title="option.key"
              @click="contextMenu && setFolderColor(contextMenu.node.path, option.key); close()"
            >
              <span class="h-5 w-5 rounded-full" :class="option.bgClass" />
            </button>
          </div>
          <button
            type="button"
            class="mt-1.5 w-full rounded-md px-2 py-1.5 text-left text-xs text-content-tertiary transition-colors duration-150 hover:bg-white/[0.04] hover:text-content-primary focus-visible:outline-none"
            @click="contextMenu && setFolderColor(contextMenu.node.path, null); close()"
          >
            Zurücksetzen
          </button>
        </div>
      </template>
    </ContextMenu>

    <ConfirmDialog
      v-if="pendingDelete"
      title="Löschen"
      :message="deleteConfirmMessage"
      confirm-label="Löschen"
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
    />

    <DetailsPopover
      v-if="detailsTarget"
      :node="detailsTarget"
      @close="detailsTarget = null"
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

      <!-- contain-paint (not just overflow-hidden) - this row's inner content
           is `transition-transform`ed on drag/swipe, and a plain
           overflow-hidden + rounded-md ancestor next to a transformed/
           animated descendant is a known Chromium compositing seam: the
           rounded clip can let a sliver of the descendant paint past the
           rounded corner into whatever sits below it (here: the next row's
           action-zone strip bleeding a few px into the row underneath).
           contain: paint is a hard guarantee - nothing in this box can ever
           paint outside its border box, regardless of any transform/
           compositing happening inside it. -->
      <div v-else class="relative overflow-hidden rounded-md contain-paint" :data-row-path="node.path">
        <!-- Swipe-right reveal: Favorisieren (both node types) -->
        <div v-show="swipeOffsetOf(node) > 0 || swipeRevealedOf(node) === 'right'" class="absolute inset-y-0 left-0 flex">
          <button
            type="button"
            class="flex w-16 shrink-0 items-center justify-center bg-accent-strong text-white"
            @click="toggleFavorite(node.path); resetRowSwipe(node.path)"
          >
            <Star class="h-4 w-4" stroke-width="1.5" :fill="isFavorite(node.path) ? 'currentColor' : 'none'" />
          </button>
        </div>

        <!-- Swipe-left reveal: files get Archivieren+Löschen, folders get Verschieben nach…
             divide-x/divide-base draws a 1px seam between Archivieren and Löschen so the two
             fills read as distinct zones instead of one solid two-tone block (no-op for the
             single-button folder case). -->
        <div v-show="swipeOffsetOf(node) < 0 || swipeRevealedOf(node) === 'left'" class="absolute inset-y-0 right-0 flex divide-x divide-base">
          <template v-if="node.type === 'file'">
            <button
              type="button"
              class="flex w-16 shrink-0 items-center justify-center bg-success-strong text-white"
              @click="archiveNode(node); resetRowSwipe(node.path)"
            >
              <Archive class="h-4 w-4" stroke-width="1.5" />
            </button>
            <button
              type="button"
              class="flex w-16 shrink-0 items-center justify-center bg-danger-strong text-white"
              @click="requestDelete(node); resetRowSwipe(node.path)"
            >
              <Trash2 class="h-4 w-4" stroke-width="1.5" />
            </button>
          </template>
          <button
            v-else
            type="button"
            class="flex w-16 shrink-0 items-center justify-center bg-accent-strong text-white"
            @click="openMoveFromSwipe(node, $event)"
          >
            <Move class="h-4 w-4" stroke-width="1.5" />
          </button>
        </div>

        <div
          role="button"
          tabindex="0"
          :draggable="!isMobile"
          data-no-edge-swipe
          class="group no-touch-callout relative z-10 flex w-full cursor-pointer touch-pan-y items-center gap-2 bg-base px-2.5 py-1.5 text-left transition-colors duration-150 active:bg-white/[0.06]"
          :class="[
            draggingPath === node.path ? '' : 'transition-transform duration-150 ease-out',
            tabs.activePath === node.path || (node.type === 'folder' && vaultTree.selectedFolder === node.path) ? 'bg-accent/[0.12] font-medium text-content-primary' : 'text-content-secondary hover:bg-white/[0.06] hover:text-content-primary',
            isDragOver(node) ? 'ring-1 ring-inset ring-accent/40 bg-surface-2' : '',
            isDragging(node) ? 'opacity-50' : '',
            isExternalDragOver(node) ? 'ring-1 ring-inset ring-dashed ring-accent bg-surface-2' : '',
            wasRecentlyImported(node) ? 'bg-accent/20' : ''
          ]"
          :style="{ transform: `translateX(${swipeOffsetOf(node)}px)` }"
          @click="onNodeClick(node)"
          @keydown.enter.prevent="onNodeClick(node)"
          @keydown.space.prevent="onNodeClick(node)"
          @contextmenu="onContextMenu($event, node)"
          @dragstart="onDragStart($event, node)"
          @dragend="onDragEnd"
          @dragover="onDragOver($event, node)"
          @dragleave="onDragLeave($event, node)"
          @drop="onDrop($event, node)"
          @pointerdown="onRowPointerDown($event, node)"
          @pointermove="onRowPointerMove($event, node)"
          @pointerup="onRowPointerUp($event, node)"
          @pointercancel="onRowPointerCancel(node)"
        >
          <span class="flex shrink-0 items-center gap-0.5">
            <ChevronRight
              v-if="node.type === 'folder'"
              class="h-3.5 w-3.5 text-content-tertiary/60 transition-transform duration-150 group-hover:text-content-tertiary/80"
              :class="isExpanded(node) ? 'rotate-90' : ''"
              stroke-width="2"
            />
            <span v-else class="inline-block h-3.5 w-3.5" />
            <component
              :is="nodeIcon(node)"
              class="h-4 w-4"
              :class="node.type === 'folder' ? folderIconColor(node.path) : 'text-content-tertiary/60'"
              stroke-width="1.5"
            />
          </span>
          <span class="flex-1 truncate">{{ node.name }}</span>
          <button
            v-if="node.type === 'file' && swipeOffsetOf(node) === 0"
            type="button"
            class="shrink-0 rounded-md p-1 transition duration-150 active:scale-90"
            :class="isFavorite(node.path) ? 'text-accent' : 'text-content-tertiary/50 opacity-0 group-hover:opacity-100 hover:text-accent focus:opacity-100'"
            :title="isFavorite(node.path) ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'"
            @click.stop="toggleFavorite(node.path)"
          >
            <Star class="h-3.5 w-3.5" stroke-width="1.5" :fill="isFavorite(node.path) ? 'currentColor' : 'none'" />
          </button>
        </div>
      </div>

      <Transition
        enter-active-class="grid transition-all duration-150 ease-out"
        leave-active-class="grid transition-all duration-150 ease-out"
        enter-from-class="grid-rows-collapsed"
        enter-to-class="grid-rows-expanded"
        leave-from-class="grid-rows-expanded"
        leave-to-class="grid-rows-collapsed"
      >
        <div v-if="node.type === 'folder' && isExpanded(node)" class="ml-3.5 border-l border-white/[0.05] pl-1">
          <div class="overflow-hidden">
            <VaultTree :nodes="node.children ?? []" :parent-path="node.path" />
          </div>
        </div>
      </Transition>
    </li>
  </ul>
</template>
