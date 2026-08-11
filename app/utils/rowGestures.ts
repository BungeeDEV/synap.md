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
/** Width of a single swipe-action button - the base unit every reveal zone's width is built from (1x for a single-action zone, 2x for Archivieren+Löschen, etc). */
export const ACTION_BUTTON_PX = 64
/**
 * A settled/dragged reveal can overshoot the zone's actual width by this
 * factor - gives the row a bit of rubber-band travel past full-reveal, and
 * (deliberately) guarantees the fling threshold (== the zone's full width)
 * always sits inside the reachable drag range. Previously the overdrag cap
 * was a fixed 1.6x of a fixed 64px reveal width (102.4px) while the fling
 * threshold was a separate fixed 120px constant - for any zone wider than
 * one button (e.g. the 128px Archivieren+Löschen zone) those two numbers
 * had no relation to each other, and for the single-button zones 120 > 102.4
 * meant fling could never actually be reached by a real drag. Deriving both
 * from the same per-zone revealWidth removes the possibility of that drift.
 */
export const OVERDRAG_FACTOR = 1.2
/** A fling must reach the zone's full width within this long to fire the default action immediately instead of just revealing it. */
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

/** Clamps a raw drag delta to +/- revealWidth * OVERDRAG_FACTOR - the actual pixel width of the zone being swiped open, not a fixed constant, since that width differs per row (1 vs 2 action buttons). */
export function clampSwipeOffset(dx: number, revealWidth: number): number {
  const max = revealWidth * OVERDRAG_FACTOR
  return Math.max(-max, Math.min(max, dx))
}

export type SwipeOutcome = 'snap-back' | 'reveal' | 'fling'

/** revealWidth is the actual pixel width of the zone being swiped open (see clampSwipeOffset) - reaching half of it commits to 'reveal', reaching all of it within FLING_MS commits to 'fling'. */
export function resolveSwipeOutcome(offsetX: number, elapsedMs: number, revealWidth: number): SwipeOutcome {
  const distance = Math.abs(offsetX)
  if (distance >= revealWidth && elapsedMs <= FLING_MS) return 'fling'
  if (distance >= revealWidth / 2) return 'reveal'
  return 'snap-back'
}
