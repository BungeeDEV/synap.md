import { describe, expect, it } from 'vitest'
import {
  ACTION_BUTTON_PX,
  DIRECTION_LOCK_PX,
  FLING_MS,
  MOVE_CANCEL_PX,
  OVERDRAG_FACTOR,
  clampSwipeOffset,
  exceedsMoveCancel,
  lockedDirection,
  resolveSwipeOutcome,
  revealSideOf
} from './rowGestures'

describe('exceedsMoveCancel', () => {
  it('is false for tiny jitter', () => {
    expect(exceedsMoveCancel(1, 1)).toBe(false)
  })

  it('is true once distance passes the threshold', () => {
    expect(exceedsMoveCancel(MOVE_CANCEL_PX + 1, 0)).toBe(true)
  })
})

describe('lockedDirection', () => {
  it('is null before the direction-lock threshold is reached', () => {
    expect(lockedDirection(DIRECTION_LOCK_PX - 1, 0)).toBeNull()
  })

  it('locks horizontal when dx dominates', () => {
    expect(lockedDirection(20, 2)).toBe('horizontal')
  })

  it('locks vertical when dy dominates', () => {
    expect(lockedDirection(2, 20)).toBe('vertical')
  })
})

describe('revealSideOf', () => {
  it('is left for negative offsets', () => {
    expect(revealSideOf(-10)).toBe('left')
  })

  it('is right for positive offsets', () => {
    expect(revealSideOf(10)).toBe('right')
  })

  it('is null at zero', () => {
    expect(revealSideOf(0)).toBeNull()
  })
})

describe('clampSwipeOffset', () => {
  it('passes drags within the zone width through unchanged', () => {
    expect(clampSwipeOffset(20, ACTION_BUTTON_PX)).toBe(20)
  })

  it('clamps to revealWidth * OVERDRAG_FACTOR in the positive direction', () => {
    expect(clampSwipeOffset(1000, ACTION_BUTTON_PX)).toBe(ACTION_BUTTON_PX * OVERDRAG_FACTOR)
  })

  it('clamps to -(revealWidth * OVERDRAG_FACTOR) in the negative direction', () => {
    expect(clampSwipeOffset(-1000, ACTION_BUTTON_PX)).toBe(-ACTION_BUTTON_PX * OVERDRAG_FACTOR)
  })

  it('scales the clamp with a wider zone (e.g. the two-button Archivieren+Löschen zone)', () => {
    const doubleWidth = ACTION_BUTTON_PX * 2
    expect(clampSwipeOffset(-1000, doubleWidth)).toBe(-doubleWidth * OVERDRAG_FACTOR)
  })

  it('regression guard: the clamp must never sit below the fling threshold (revealWidth) for any zone width', () => {
    for (const revealWidth of [ACTION_BUTTON_PX, ACTION_BUTTON_PX * 2]) {
      expect(clampSwipeOffset(revealWidth * 10, revealWidth)).toBeGreaterThanOrEqual(revealWidth)
    }
  })
})

describe('resolveSwipeOutcome', () => {
  const SINGLE = ACTION_BUTTON_PX // Favorisieren / Verschieben zone
  const DOUBLE = ACTION_BUTTON_PX * 2 // Archivieren+Löschen zone

  it('snaps back for a short, slow drag', () => {
    expect(resolveSwipeOutcome(SINGLE / 2 - 1, 1000, SINGLE)).toBe('snap-back')
  })

  it('reveals once past half the zone width, if too slow/short to fling', () => {
    expect(resolveSwipeOutcome(SINGLE / 2, 1000, SINGLE)).toBe('reveal')
  })

  it('flings for a fast swipe reaching the full, actually-reachable zone width within FLING_MS', () => {
    // reachable in practice: clampSwipeOffset never limits offsetX below SINGLE for a SINGLE-wide zone
    expect(resolveSwipeOutcome(SINGLE, FLING_MS - 10, SINGLE)).toBe('fling')
  })

  it('only reveals (not flings) a swipe reaching the full zone width that took too long', () => {
    expect(resolveSwipeOutcome(SINGLE, FLING_MS + 500, SINGLE)).toBe('reveal')
  })

  it('treats negative offsets (swipe left) the same as positive (swipe right)', () => {
    expect(resolveSwipeOutcome(-SINGLE, FLING_MS - 10, SINGLE)).toBe('fling')
  })

  it('scales the reveal/fling thresholds to a wider zone - halfway across DOUBLE is not yet a reveal of SINGLE', () => {
    expect(resolveSwipeOutcome(-(SINGLE / 2), 1000, DOUBLE)).toBe('snap-back') // 32px < 128/2=64px
    expect(resolveSwipeOutcome(-SINGLE, 1000, DOUBLE)).toBe('reveal') // 64px >= 128/2, < 128
    expect(resolveSwipeOutcome(-DOUBLE, FLING_MS - 10, DOUBLE)).toBe('fling') // reaches the full 128px in time
  })
})
