/**
 * The table of contents a deck carries (R17).
 *
 * An entry is named by the slide's own first heading, so a deck gains a table
 * of contents by being written and nothing else. A slide that has no heading is
 * still an entry: it is named by its number, so the list always covers the
 * whole deck. The slide's own second-level headings are listed under its
 * entry, so the contents read as an outline of the deck.
 */

/**
 * One slide's place in the table of contents: its own name, and the
 * second-level headings that sit under it.
 */
export interface ContentsSlide {
  /** The slide's first heading, or its number when it has none. */
  title: string
  /** The slide's own second-level headings, in document order. */
  sections: string[]
}

/**
 * The text of a heading, with its whitespace collapsed to single spaces;
 * `null` when there is no text at all.
 */
export function headingText(heading: string | null | undefined): string | null {
  const text = heading?.replace(/\s+/g, ' ').trim()
  return text || null
}

/**
 * The label one entry shows. `heading` is the slide's first heading's text, or
 * `null` when the slide has none; `position` is the slide's zero-based place in
 * the deck.
 */
export function contentsLabel(heading: string | null | undefined, position: number): string {
  return headingText(heading) ?? `Slide ${position + 1}`
}

/** Whether two outlines say the same thing, so the deck can keep the one it
 * has instead of re-rendering the contents on every position change (R17). */
export function sameOutline(current: ContentsSlide[], next: ContentsSlide[]): boolean {
  return (
    current.length === next.length &&
    current.every((slide, position) => {
      const other = next[position]
      return (
        other !== undefined &&
        slide.title === other.title &&
        slide.sections.length === other.sections.length &&
        slide.sections.every((section, index) => section === other.sections[index])
      )
    })
  )
}
