import { lockedDirection } from '~/utils/rowGestures'

/** How close to the left screen edge a touch must start to arm the open-drawer gesture. */
const EDGE_ZONE_PX = 24
/** How far the gesture has to travel horizontally before it actually opens/closes the drawer. */
const OPEN_THRESHOLD_PX = 60

interface EdgeGesture {
  startX: number
  startY: number
  direction: 'horizontal' | 'vertical' | null
  mode: 'open' | 'close'
}

/**
 * Native-style edge-swipe for the mobile sidebar drawer: swipe right from
 * the left edge to open, swipe left anywhere on the open sidebar (except a
 * list item, which owns its own swipe-to-reveal gesture) to close. Reuses
 * rowGestures.ts's direction-lock math (the same primitive VaultTree.vue's
 * row swipe already uses) rather than a second gesture implementation.
 *
 * Only triggers the drawer's own open()/close() actions - the actual
 * slide animation is VaultSidebar.vue's existing CSS transition, not a
 * live drag-follow, so there's no separate visual state to manage here.
 */
export function useEdgeSwipe() {
  const mobileNav = useMobileNavStore()
  let gesture: EdgeGesture | null = null

  function onPointerDown(event: PointerEvent): void {
    gesture = null
    if (event.pointerType === 'mouse') return

    if (!mobileNav.isDrawerOpen) {
      if (event.clientX > EDGE_ZONE_PX) return
      gesture = { startX: event.clientX, startY: event.clientY, direction: null, mode: 'open' }
      return
    }

    // Drawer already open: don't arm a close-swipe if this gesture started
    // on a list item (VaultTree row, sidebar favorite) - those handle their
    // own horizontal swipe already, and must not be fought over.
    const target = event.target as HTMLElement | null
    if (target?.closest('[data-no-edge-swipe]')) return
    gesture = { startX: event.clientX, startY: event.clientY, direction: null, mode: 'close' }
  }

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerType === 'mouse' || !gesture) return

    if (gesture.direction === null) {
      const dx = event.clientX - gesture.startX
      const dy = event.clientY - gesture.startY
      const direction = lockedDirection(dx, dy)
      if (direction === null) return
      if (direction === 'vertical') {
        gesture = null // this is a scroll, not an edge-swipe - let it through untouched
        return
      }
      gesture.direction = direction
    }

    // Confirmed horizontal: this is our gesture now, not the browser's
    // (iOS Safari in particular treats an edge-right-swipe as "go back" -
    // suppress that for the duration of this drag).
    event.preventDefault()
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.pointerType === 'mouse' || !gesture) { gesture = null; return }
    if (gesture.direction !== 'horizontal') { gesture = null; return }

    const dx = event.clientX - gesture.startX
    if (gesture.mode === 'open' && dx > OPEN_THRESHOLD_PX) mobileNav.open()
    else if (gesture.mode === 'close' && dx < -OPEN_THRESHOLD_PX) mobileNav.close()
    gesture = null
  }

  function onPointerCancel(): void {
    gesture = null
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }
}
