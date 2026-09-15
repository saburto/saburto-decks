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
  /** The deck's table of contents: one label per slide, in order (R17). */
  titles: string[]
  /** Go to a slide by its zero-based position, the way an entry does (R17). */
  goTo: (index: number) => void
}

export const SlideContext = createContext<SlideState>({
  index: 0,
  count: 0,
  step: 0,
  theme: 'light',
  refresh: () => {},
  measure: null,
  titles: [],
  goTo: () => {}
})

/**
 * Which slide a piece of content is on. `Slide` provides its own position, so
 * content that has to know it — an annotation deciding whether the reader has
 * reached its step (R15) — can read it without walking the DOM.
 */
export const SlideNumberContext = createContext(0)

/**
 * Where an included file's slides begin in the deck that included it (R18).
 * The build sets it from the slides before the include, so an included deck
 * numbers its own slides from zero and the deck around it makes them its own.
 */
export const SlideOffsetContext = createContext(0)

/**
 * Whether a slide is already inside one. An include used within a slide is
 * that slide's content, not slides of its own, so its slides render as plain
 * content there (R18).
 */
export const SlideNestedContext = createContext(false)

/**
 * One slide.
 *
 * `remark-slides` wraps every group of nodes between two `---` in this
 * component while the deck is compiled, so a deck author never writes it. A
 * slide that is itself inside a slide — the slides of an included file used as
 * content (R18) — has no place of its own: it renders its content and leaves
 * the slide around it alone.
 *
 * All slides stay in the DOM and only the current one is shown. Nothing about
 * a slide is ever scrolled — see `#fitStage` in `Deck`.
 */
export function Slide({ index, children }: { index?: string; children?: ReactNode }) {
  const { index: current, count } = useContext(SlideContext)
  const offset = useContext(SlideOffsetContext)
  const nested = useContext(SlideNestedContext)
  const position = Number(index ?? 0) + offset

  if (nested) return <>{children}</>

  const active = position === current

  return (
    <section
      className="slide hidden w-full max-w-[72cqi] break-words data-[active]:block [&>:first-child]:mt-0 [&>:last-child]:mb-0"
      data-index={position}
      data-active={active ? '' : undefined}
      aria-roledescription="slide"
      aria-label={`${position + 1} of ${count}`}
      inert={!active}
    >
      <SlideNumberContext.Provider value={position}>
        <SlideNestedContext.Provider value={true}>{children}</SlideNestedContext.Provider>
      </SlideNumberContext.Provider>
    </section>
  )
}
