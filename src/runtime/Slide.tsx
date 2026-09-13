import { createContext, useContext, type ComponentType, type ReactNode } from 'react'

export type DeckMode = 'embedded' | 'present'

/** Who decides the palette. The deck never guesses. */
export type DeckTheme = 'light' | 'dark' | 'system'

/** A compiled deck file: `import slides from './my-deck.mdx'`. */
export type DeckComponent = ComponentType<Record<string, unknown>>

/**
 * What a slide and its contents know about the deck around them.
 *
 * `refresh` lets content that arrives after its first render — a diagram drawn
 * by Mermaid, which is asynchronous — ask the deck to measure it and apply its
 * step again (R13, R14).
 */
interface SlideState {
  index: number
  count: number
  /** Which step of the current slide the reader is on (R12). */
  step: number
  theme: DeckTheme
  refresh: () => void
  /** Where a diagram may be built and measured, off the host page's flow. */
  measure: HTMLElement | null
}

export const SlideContext = createContext<SlideState>({
  index: 0,
  count: 0,
  step: 0,
  theme: 'light',
  refresh: () => {},
  measure: null
})

/**
 * Which slide a piece of content is on. `Slide` provides its own position, so
 * content that has to know it — an annotation deciding whether the reader has
 * reached its step (R15) — can read it without walking the DOM.
 */
export const SlideNumberContext = createContext(0)

/**
 * One slide.
 *
 * `remark-slides` wraps every group of nodes between two `---` in this
 * component while the deck is compiled, so a deck author never writes it.
 *
 * All slides stay in the DOM and only the current one is shown. Nothing about
 * a slide is ever scrolled — see `#fitStage` in `Deck`.
 */
export function Slide({ index, children }: { index?: string; children?: ReactNode }) {
  const { index: current, count } = useContext(SlideContext)
  const position = Number(index ?? 0)
  const active = position === current

  return (
    <section
      className="slide"
      data-index={position}
      data-active={active ? '' : undefined}
      aria-roledescription="slide"
      aria-label={`${position + 1} of ${count}`}
      inert={!active}
    >
      <SlideNumberContext.Provider value={position}>{children}</SlideNumberContext.Provider>
    </section>
  )
}
