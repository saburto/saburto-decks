/**
 * The table of contents' labels (R17).
 *
 * The deck is rendered in a browser; this is the one piece of the contents
 * that can be reasoned about on its own, so it is tested on its own. Its
 * fallback is what the end-to-end suite cannot reach: the example deck happens
 * to give every slide a heading.
 */
import { describe, expect, test } from 'bun:test'
import { contentsLabel } from '../src/runtime/contents.ts'

describe('contentsLabel', () => {
  test("names an entry by the slide's own heading", () => {
    expect(contentsLabel('Writing a deck', 0)).toBe('Writing a deck')
  })

  test('collapses a heading that is spread over several lines', () => {
    expect(contentsLabel('  Writing\n  a   deck  ', 3)).toBe('Writing a deck')
  })

  test('names a slide without a heading by its number', () => {
    expect(contentsLabel(undefined, 0)).toBe('Slide 1')
    expect(contentsLabel(null, 4)).toBe('Slide 5')
    expect(contentsLabel('', 9)).toBe('Slide 10')
  })

  test('treats a heading that is only whitespace as no heading', () => {
    expect(contentsLabel('   \n\t ', 1)).toBe('Slide 2')
  })
})
