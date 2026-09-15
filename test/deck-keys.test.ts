/**
 * What a key means to a deck (R6, R12, R17, N1): the deck's own keys, and the
 * contents' keys while the contents own the keyboard.
 *
 * The rules are the product's — Escape leaves present mode but not the page,
 * navigation keys do not reach the deck while the contents are open, the
 * arrows stop at the ends of the list — and they are all decisions, so they
 * are tested as decisions.
 */
import { describe, expect, test } from 'bun:test'
import { contentsCommand, deckCommand } from '../src/runtime/deck/keys'

describe('the deck’s own keys', () => {
  test('Escape leaves present mode, and only then (R6)', () => {
    expect(deckCommand('Escape', true)).toEqual({ kind: 'exit' })
    expect(deckCommand('Escape', false)).toEqual({ kind: 'none' })
  })

  test('o opens the contents, in either mode (R17)', () => {
    expect(deckCommand('o', false)).toEqual({ kind: 'contents' })
    expect(deckCommand('O', true)).toEqual({ kind: 'contents' })
  })

  test('the forward keys all mean next, and the back keys all mean previous (R6)', () => {
    for (const key of ['ArrowRight', 'ArrowDown', 'PageDown', ' ']) {
      expect(deckCommand(key, true)).toEqual({ kind: 'next' })
    }
    for (const key of ['ArrowLeft', 'ArrowUp', 'PageUp']) {
      expect(deckCommand(key, true)).toEqual({ kind: 'prev' })
    }
  })

  test('Home and End are the ends of the deck', () => {
    expect(deckCommand('Home', true)).toEqual({ kind: 'first' })
    expect(deckCommand('End', true)).toEqual({ kind: 'last' })
  })

  test('Tab is a command, because it means something different in each mode (N1)', () => {
    expect(deckCommand('Tab', true)).toEqual({ kind: 'tab' })
    expect(deckCommand('Tab', false)).toEqual({ kind: 'tab' })
  })

  test('a key the deck does not use is left to the page', () => {
    expect(deckCommand('a', true)).toEqual({ kind: 'none' })
    expect(deckCommand('Enter', false)).toEqual({ kind: 'none' })
  })
})

describe('the contents’ keys', () => {
  test('Escape and o dismiss them (R17)', () => {
    expect(contentsCommand('Escape', 0, 3)).toEqual({ kind: 'close' })
    expect(contentsCommand('o', 1, 3)).toEqual({ kind: 'close' })
  })

  test('the arrows move through the entries, and stop at the ends', () => {
    expect(contentsCommand('ArrowDown', 0, 3)).toEqual({ kind: 'focus', entry: 1 })
    expect(contentsCommand('ArrowUp', 1, 3)).toEqual({ kind: 'focus', entry: 0 })
    expect(contentsCommand('ArrowDown', 2, 3)).toEqual({ kind: 'focus', entry: 2 })
    expect(contentsCommand('ArrowUp', 0, 3)).toEqual({ kind: 'focus', entry: 0 })
  })

  test('with nothing focused, they start at the first entry', () => {
    expect(contentsCommand('ArrowDown', -1, 3)).toEqual({ kind: 'focus', entry: 0 })
    expect(contentsCommand('ArrowUp', -1, 3)).toEqual({ kind: 'focus', entry: 0 })
  })

  test('Home and End are the ends of the list', () => {
    expect(contentsCommand('Home', 2, 3)).toEqual({ kind: 'focus', entry: 0 })
    expect(contentsCommand('End', 0, 3)).toEqual({ kind: 'focus', entry: 2 })
  })

  test('an empty list has nowhere to move', () => {
    expect(contentsCommand('ArrowDown', -1, 0)).toEqual({ kind: 'none' })
    expect(contentsCommand('End', -1, 0)).toEqual({ kind: 'none' })
  })

  test('Tab stays within the contents: they are one control until dismissed (N1)', () => {
    expect(contentsCommand('Tab', 0, 3)).toEqual({ kind: 'tab' })
  })

  test('a navigation key that is not a contents key does nothing here', () => {
    expect(contentsCommand(' ', 0, 3)).toEqual({ kind: 'none' })
    expect(contentsCommand('PageDown', 0, 3)).toEqual({ kind: 'none' })
  })
})
