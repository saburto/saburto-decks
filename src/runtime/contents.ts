/**
 * The table of contents a deck carries (R17).
 *
 * An entry is named by the slide's own first heading, so a deck gains a table
 * of contents by being written and nothing else. A slide that has no heading is
 * still an entry: it is named by its number, so the list always covers the
 * whole deck.
 */

/**
 * The label one entry shows. `heading` is the slide's first heading's text, or
 * `null` when the slide has none; `position` is the slide's zero-based place in
 * the deck.
 */
export function contentsLabel(heading: string | null | undefined, position: number): string {
  const text = heading?.replace(/\s+/g, ' ').trim()
  return text || `Slide ${position + 1}`
}
