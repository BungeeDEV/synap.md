/**
 * Pure gesture-math for VaultTree.vue's row long-press/swipe handling - no
 * Vue/DOM imports, so the thresholds and outcome logic (the one part of a
 * touch gesture system that's actually meaningful to unit-test) can be
 * tested directly, matching the server/utils/*.test.ts convention.
 */

export const LONG_PRESS_MS = 500
/** Movement beyond this cancels a pending long-press - it's a drag/scroll attempt, not a hold. */
export const MOVE_CANCEL_PX = 10
/** Movement beyond this locks the gesture to horizontal (swipe) or vertical (scroll). */
export const DIRECTION_LOCK_PX = 8
/** Short-swipe reveal width - roughly one action button's worth of travel. */
export const REVEAL_PX = 64
/** Fast/far swipe distance that executes the default action immediately instead of just revealing it. */
export const FLING_PX = 120
/** A swipe past FLING_PX only counts as a fling if it happened within this long. */
export const FLING_MS = 300

export interface SwipeState {
  offsetX: number
  revealed: 'left' | 'right' | null
}

export function exceedsMoveCancel(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > MOVE_CANCEL_PX
}

/** Returns null until movement exceeds DIRECTION_LOCK_PX, then locks to whichever axis dominates. */
export function lockedDirection(dx: number, dy: number): 'horizontal' | 'vertical' | null {
  if (Math.hypot(dx, dy) < DIRECTION_LOCK_PX) return null
  return Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical'
}

export function revealSideOf(offsetX: number): 'left' | 'right' | null {
  if (offsetX < 0) return 'left'
  if (offsetX > 0) return 'right'
  return null
}

export type SwipeOutcome = 'snap-back' | 'reveal' | 'fling'

export function resolveSwipeOutcome(offsetX: number, elapsedMs: number): SwipeOutcome {
  const distance = Math.abs(offsetX)
  if (distance >= FLING_PX && elapsedMs <= FLING_MS) return 'fling'
  if (distance >= REVEAL_PX) return 'reveal'
  return 'snap-back'
}
