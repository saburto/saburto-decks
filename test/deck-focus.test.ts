/**
 * Focus containment (N1): where Tab carries focus when it would otherwise
 * leave the deck.
 *
 * The decision is a pure function, so it is tested here; the DOM reading and
 * the `.focus()` call are in `useDeckKeyboard`, and are covered end to end.
 */
import { describe, expect, test } from 'bun:test'
import { wrapFocus } from '../src/runtime/deck/dom'

describe('wrapFocus', () => {
  test('Tab from the last control goes to the first, so focus never leaves', () => {
    expect(wrapFocus(false, 2, 3)).toBe(0)
  })

  test('Shift+Tab from the first goes to the last', () => {
    expect(wrapFocus(true, 0, 3)).toBe(3 - 1)
  })

  test('with nothing inside focused — the host itself holds focus — it enters the deck', () => {
    expect(wrapFocus(false, -1, 3)).toBe(0)
    expect(wrapFocus(true, -1, 3)).toBe(2)
  })

  test('in the middle of the controls, the browser’s own order is right', () => {
    expect(wrapFocus(false, 0, 3)).toBeNull()
    expect(wrapFocus(true, 2, 3)).toBeNull()
  })

  test('a deck with nothing focusable is left to the caller', () => {
    expect(wrapFocus(false, -1, 0)).toBeNull()
    expect(wrapFocus(true, -1, 0)).toBeNull()
  })

  test('a single control is its own first and last, whichever way Tab goes', () => {
    expect(wrapFocus(false, 0, 1)).toBe(0)
    expect(wrapFocus(true, 0, 1)).toBe(0)
  })
})
