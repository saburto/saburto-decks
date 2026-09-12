import { createContext, useContext, type ComponentType, type ReactNode } from 'react'

export type DeckMode = 'embedded' | 'present'

/** Who decides the palette. The deck never guesses. */
export type DeckTheme = 'light' | 'dark' | 'system'

/** A compiled deck file: `import slides from './my-deck.mdx'`. */
export type DeckComponent = ComponentType<Record<string, unknown>>

interface SlideState {
  index: number
  count: number
}

export const SlideContext = createContext<SlideState>({ index: 0, count: 0 })

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
      {children}
    </section>
  )
}
