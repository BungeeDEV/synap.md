import { describe, expect, it } from 'vitest'
import {
  DIRECTION_LOCK_PX,
  FLING_MS,
  FLING_PX,
  MOVE_CANCEL_PX,
  REVEAL_PX,
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

describe('resolveSwipeOutcome', () => {
  it('snaps back for a short, slow drag', () => {
    expect(resolveSwipeOutcome(REVEAL_PX - 1, 1000)).toBe('snap-back')
  })

  it('reveals for a drag past REVEAL_PX that is too slow/short to fling', () => {
    expect(resolveSwipeOutcome(REVEAL_PX, 1000)).toBe('reveal')
  })

  it('flings for a fast swipe past FLING_PX within FLING_MS', () => {
    expect(resolveSwipeOutcome(FLING_PX, FLING_MS - 10)).toBe('fling')
  })

  it('only reveals (not flings) a swipe past FLING_PX that took too long', () => {
    expect(resolveSwipeOutcome(FLING_PX, FLING_MS + 500)).toBe('reveal')
  })

  it('treats negative offsets (swipe left) the same as positive (swipe right)', () => {
    expect(resolveSwipeOutcome(-FLING_PX, FLING_MS - 10)).toBe('fling')
  })
})
