/**
 * Fitting a slide to its box (R5): the search for the largest type size that
 * still fits.
 *
 * The bisection is a pure function of "does this size fit?", so it is tested
 * against made-up shapes of content — one capped by a width, one whose height
 * grows with the square of the size — instead of a real slide, which the end
 * to end suite covers.
 */
import { describe, expect, test } from 'bun:test'
import { fitFontSize } from '../src/runtime/deck/useStageLayout'

describe('fitFontSize', () => {
  test('finds the largest size that fits when the content is capped', () => {
    const size = fitFontSize(100, (candidate) => candidate < 20)
    expect(size).toBeLessThan(20)
    expect(size).toBeGreaterThan(19.9)
  })

  test('finds the square root when height grows with the square of the size', () => {
    /* A run of text 100px tall at 10px is 100px tall at 10px: exactly 10 fits. */
    const size = fitFontSize(100, (candidate) => candidate * candidate <= 100)
    expect(size).toBeCloseTo(10, 1)
  })

  test('everything fits: it keeps the size the deck already had', () => {
    expect(fitFontSize(37, () => true)).toBeCloseTo(37, 2)
  })

  test('nothing fits: it gives up rather than returning a size that does not', () => {
    expect(fitFontSize(37, () => false)).toBe(0)
  })

  test('never returns a size that does not fit', () => {
    const ceiling = 13.5
    expect(fitFontSize(80, (candidate) => candidate <= ceiling)).toBeLessThanOrEqual(ceiling)
  })
})
