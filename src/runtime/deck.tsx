import { createContext, useContext, useMemo, type ComponentType, type ReactNode } from 'react'

export type DeckMode = 'embedded' | 'present'

/** A compiled MDX deck. */
export type DeckComponent = ComponentType<Record<string, unknown>>

interface SlideState {
  index: number
  count: number
}

const SlideContext = createContext<SlideState>({ index: 0, count: 0 })

/**
 * One slide. The build step wraps every group of nodes between two `---` in
 * this component, so authors never write it themselves.
 *
 * All slides stay in the DOM and only the current one is shown, in both modes.
 * That keeps the deck's content addressable and means moving between embedded
 * and present mode costs no re-render of the deck itself (R7).
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

export interface DeckViewProps {
  Component: DeckComponent
  mode: DeckMode
  index: number
  count: number
  onPrev: () => void
  onNext: () => void
  onToggleFullscreen: () => void
}

/**
 * Draws the deck. Deliberately stateless: the custom element owns the mode and
 * the slide position, React only renders them.
 */
export function DeckView({ Component, mode, index, count, onPrev, onNext, onToggleFullscreen }: DeckViewProps) {
  const components = useMemo(() => ({ Slide }), [])
  const presenting = mode === 'present'

  return (
    <SlideContext.Provider value={{ index, count }}>
      <div className="deck">
        {/* Re-keyed per slide so the entrance animation replays. */}
        <div className="stage" key={index}>
          <Component components={components} />
        </div>

        <div className="bar" role="toolbar" aria-label="Deck controls">
          <button type="button" onClick={onPrev} disabled={index <= 0} aria-label="Previous slide">
            ‹
          </button>
          <span className="counter" aria-hidden="true">
            {index + 1} / {count}
          </span>
          <button type="button" onClick={onNext} disabled={index >= count - 1} aria-label="Next slide">
            ›
          </button>
          <button type="button" onClick={onToggleFullscreen}>
            {presenting ? 'Exit' : 'Full screen'}
          </button>
        </div>
      </div>

      {/* Announced on every position change so a screen reader user knows
          where they are in the deck (N2). */}
      <p className="live" aria-live="polite">
        Slide {index + 1} of {count}
      </p>
    </SlideContext.Provider>
  )
}
