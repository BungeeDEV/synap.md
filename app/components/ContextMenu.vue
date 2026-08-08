<script setup lang="ts">
import { ChevronLeft } from 'lucide-vue-next'
import { isSubmenuItem, type ContextMenuGroup, type ContextMenuItem } from '~/utils/contextMenuTypes'

const props = defineProps<{ open: boolean, x: number, y: number, groups: ContextMenuGroup[], initialSubmenu?: string }>()
const emit = defineEmits<{ close: [] }>()

const { isMobile } = useIsMobile()

function submenuNameOf(item: ContextMenuItem): string | undefined {
  return isSubmenuItem(item) ? item.submenu : undefined
}

const panelRef = ref<HTMLDivElement | null>(null)
const style = ref({ left: '0px', top: '0px' })
// Same id drives both chrome variants: a desktop flyout panel anchored next
// to the item, or a mobile bottom-sheet drill-down replacing the group list
// - conceptually the same "which submenu is active" state either way.
const activeSubmenuId = ref<string | null>(null)

// Flattened (item + owning group index) so keyboard nav can move through
// every group in one sequence while still knowing where to render dividers.
const flatItems = computed(() => {
  const result: { item: ContextMenuItem, groupIndex: number }[] = []
  props.groups.forEach((group, groupIndex) => {
    for (const item of group) result.push({ item, groupIndex })
  })
  return result
})

const selectedIndex = ref(0)
const selectedId = computed(() => flatItems.value[selectedIndex.value]?.item.id ?? null)

function isSelectable(item: ContextMenuItem): boolean {
  return !item.disabled
}

function moveSelection(direction: 1 | -1): void {
  const items = flatItems.value
  if (items.length === 0) return
  let next = selectedIndex.value
  for (let i = 0; i < items.length; i++) {
    next = (next + direction + items.length) % items.length
    if (isSelectable(items[next]!.item)) break
  }
  selectedIndex.value = next
  activeSubmenuId.value = null
}

function activateItem(item: ContextMenuItem): void {
  if (item.disabled) return
  if (isSubmenuItem(item)) {
    activeSubmenuId.value = activeSubmenuId.value === item.id ? null : item.id
    return
  }
  item.onSelect()
  emit('close')
}

function activateSelected(): void {
  const item = flatItems.value[selectedIndex.value]?.item
  if (item) activateItem(item)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveSelection(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveSelection(-1)
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    activateSelected()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    if (activeSubmenuId.value) activeSubmenuId.value = null
    else emit('close')
  }
}

// Viewport-safe positioning (desktop popover only - the mobile bottom sheet
// is always full-width/fixed-to-bottom, no x/y needed): place at (x, y)
// first, then flip left/up if the rendered panel would overflow the
// window, clamping as a last resort so it never gets clipped by the edge
// of the screen.
async function positionPanel(): Promise<void> {
  style.value = { left: `${props.x}px`, top: `${props.y}px` }
  await nextTick()
  const el = panelRef.value
  if (!el) return

  const rect = el.getBoundingClientRect()
  const margin = 8
  let left = props.x
  let top = props.y

  if (left + rect.width > window.innerWidth - margin) left = Math.max(margin, props.x - rect.width)
  if (top + rect.height > window.innerHeight - margin) top = Math.max(margin, props.y - rect.height)
  left = Math.min(Math.max(left, margin), window.innerWidth - rect.width - margin)
  top = Math.min(Math.max(top, margin), window.innerHeight - rect.height - margin)

  style.value = { left: `${left}px`, top: `${top}px` }
}

watch(() => [props.open, props.x, props.y], () => {
  if (!props.open) return
  selectedIndex.value = 0
  activeSubmenuId.value = props.initialSubmenu ?? null
  if (!isMobile.value) void positionPanel()
}, { immediate: true })

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('keydown', onKeydown)
    if (!isMobile.value) void nextTick(() => panelRef.value?.focus())
  } else {
    window.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <BottomSheet v-if="isMobile" :open="open" @close="emit('close')">
    <div v-if="!activeSubmenuId">
      <template v-for="(group, groupIndex) in groups" :key="groupIndex">
        <div v-if="groupIndex > 0" role="separator" class="my-1 border-t border-border" />
        <ContextMenuItem
          v-for="item in group"
          :key="item.id"
          :item="item"
          :selected="selectedId === item.id"
          size="comfortable"
          @select="activateItem(item)"
        />
      </template>
    </div>
    <div v-else>
      <button
        type="button"
        class="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-content-tertiary transition-colors duration-150 hover:bg-white/[0.04] focus-visible:outline-none"
        @click="activeSubmenuId = null"
      >
        <ChevronLeft class="h-4 w-4 shrink-0" stroke-width="1.5" />
        Zurück
      </button>
      <slot :name="activeSubmenuId ?? undefined" :close="() => emit('close')" />
    </div>
  </BottomSheet>

  <template v-else>
    <div v-if="open" class="fixed inset-0 z-40" @click="emit('close')" @contextmenu.prevent="emit('close')" />
    <Transition
      enter-active-class="transition duration-150 ease-out"
      leave-active-class="transition duration-100 ease-in"
      enter-from-class="scale-95 opacity-0"
      leave-to-class="scale-95 opacity-0"
    >
      <div
        v-if="open"
        ref="panelRef"
        role="menu"
        tabindex="-1"
        :aria-activedescendant="selectedId ?? undefined"
        class="fixed z-50 min-w-52 origin-top-left rounded-lg border border-border-strong bg-surface-1 py-1 text-content-primary shadow-float focus:outline-none"
        :style="style"
      >
        <template v-for="(group, groupIndex) in groups" :key="groupIndex">
          <div v-if="groupIndex > 0" role="separator" class="my-1 border-t border-border" />
          <div v-for="item in group" :key="item.id" class="relative">
            <ContextMenuItem
              :item="item"
              :selected="selectedId === item.id"
              @select="activateItem(item)"
              @hover="selectedIndex = flatItems.findIndex((f) => f.item.id === item.id)"
            />

            <Transition
              enter-active-class="transition duration-150 ease-out"
              leave-active-class="transition duration-100 ease-in"
              enter-from-class="scale-95 opacity-0"
              leave-to-class="scale-95 opacity-0"
            >
              <div
                v-if="isSubmenuItem(item) && activeSubmenuId === item.id"
                class="absolute top-0 left-full z-50 ml-1 min-w-52 origin-top-left rounded-lg border border-border-strong bg-surface-1 py-1 text-content-primary shadow-float"
                @click.stop
              >
                <slot :name="submenuNameOf(item)" :close="() => emit('close')" />
              </div>
            </Transition>
          </div>
        </template>
      </div>
    </Transition>
  </template>
</template>
