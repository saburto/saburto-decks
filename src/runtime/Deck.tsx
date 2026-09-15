/**
 * A deck: one slide at a time, in a box the host page sizes, or on the whole
 * screen.
 *
 * `<Deck slides={slides} />` is the whole integration. The deck renders inside
 * a shadow root of its own (R8), so the host page's CSS cannot restyle it and
 * its CSS cannot leak out.
 *
 * The component is deliberately thin: it is the composition of the deck's
 * parts, each of which owns one requirement and can be read, and tested, on
 * its own.
 *
 * - `deck/useShadowRoot` creates the shadow root the deck renders into (R8),
 *   and the ref the host's handle reads, which must not go stale (R10).
 * - `deck/useDeckPosition` owns the reader's slide and step, and everything
 *   that moves them (R2, R12, R17); the arithmetic is `steps`.
 * - `deck/usePresentMode` takes the screen and gives it back (R6, R7, R9).
 * - `deck/useStageLayout` sizes the type to the deck's box (R5) and keeps the
 *   place a diagram is measured in (R13).
 * - `deck/useContents` and `deck/useDeckKeyboard` own the controls and the
 *   keyboard (R17, N1).
 *
 * All that is left here is the one layout effect that ties them together — in
 * the only order that works: read the slides, show the step, fit the type —
 * and the markup a host renders into the page.
 */
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type HTMLAttributes
} from 'react'
import { createPortal } from 'react-dom'
import { SlideContext, type DeckComponent, type DeckMode, type DeckTheme } from './Slide'
import { deckComponents } from './components'
import { DeckComponentsContext } from './Slides'
import { deckStyles } from './styles'
import { applySteps } from './steps'
import { DeckBar } from './deck/DeckBar'
import { ContentsDialog } from './deck/ContentsDialog'
import { useIsomorphicLayoutEffect } from './deck/dom'
import { useContents } from './deck/useContents'
import { useDeckKeyboard } from './deck/useDeckKeyboard'
import { useDeckPosition } from './deck/useDeckPosition'
import { usePresentMode } from './deck/usePresentMode'
import { useShadowRoot } from './deck/useShadowRoot'
import { useStageLayout } from './deck/useStageLayout'

/** What a host can do to a deck it has a ref to. */
export interface DeckHandle {
  present(): void
  exitPresent(): void
  next(): void
  prev(): void
  /** Jump to a slide, and optionally to a step within it. Both are clamped. */
  goTo(index: number, step?: number): void
  /** Move within the current slide's steps. */
  goToStep(step: number): void
}

export interface DeckProps extends HTMLAttributes<HTMLDivElement> {
  /** The compiled deck file: `import slides from './my-deck.mdx'`. */
  slides: DeckComponent
  /** Which slide to start on. */
  defaultSlide?: number
  theme?: DeckTheme
  /** Told when the slide changes, so a host can show where the reader is. */
  onSlideChange?: (index: number, count: number) => void
  /** Told when the step within a slide changes, and how many it has (R12). */
  onStepChange?: (step: number, stepCount: number) => void
  /** Told when the deck enters or leaves present mode. */
  onModeChange?: (mode: DeckMode) => void
}

export const Deck = forwardRef<DeckHandle, DeckProps>(function Deck(
  {
    slides: Slides,
    defaultSlide = 0,
    theme = 'light',
    onSlideChange,
    onStepChange,
    onModeChange,
    className,
    style,
    ...rest
  },
  ref
) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  const shadow = useShadowRoot(hostRef)
  const position = useDeckPosition({ shadow, defaultSlide, onSlideChange, onStepChange })
  const present = usePresentMode({ hostRef, onModeChange })
  const stage = useStageLayout({ hostRef, shadow })

  /* Content that arrives after its first render — a diagram Mermaid drew —
     asks the deck to look again, so it is measured and its step applied. */
  const [, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((revision) => revision + 1), [])

  /* Learn how many slides the deck file has, keep the current slide and step
     in range, show the step, and fit the type — after every render, before
     the browser paints. */
  useIsomorphicLayoutEffect(() => {
    if (!shadow) return
    const active = position.sync()
    applySteps(active, position.stepRef.current)
    stage.fit()
  })

  const contents = useContents({ indexRef: position.indexRef })

  useDeckKeyboard({
    hostRef,
    shadow,
    position,
    contents,
    modeRef: present.modeRef,
    onExit: present.exitPresent
  })

  useImperativeHandle(
    ref,
    () => ({
      present: present.present,
      exitPresent: present.exitPresent,
      next: position.next,
      prev: position.prev,
      goTo: position.goTo,
      goToStep: position.goToStep
    }),
    [present, position]
  )

  return (
    <div
      {...rest}
      ref={hostRef}
      className={className}
      /* The box is sized here rather than only inside the shadow root, so the
         space the deck occupies is already correct in the server-rendered
         HTML, before the deck itself arrives. A host can override it with
         `--sd-aspect`, or by passing its own `style`. */
      style={{ aspectRatio: 'var(--sd-aspect, 16 / 9)', ...style }}
      tabIndex={rest.tabIndex ?? 0}
      data-mode={present.mode}
      data-theme={theme}
      data-step={position.step}
      data-steps={position.stepCount}
    >
      {shadow &&
        createPortal(
          <>
            <style>{deckStyles}</style>

            <div className="deck absolute inset-0 flex flex-col [container-type:size] bg-sd-bg text-sd-fg font-sans text-base leading-normal text-start">
              {/* The slide itself carries the entrance animation through
                  [data-active]; changing the key here would remount every
                  slide — and every diagram — on each move. */}
              <div className="stage flex-auto min-h-0 grid place-content-center relative overflow-hidden px-[6cqi] py-[4cqi] text-[clamp(0.9rem,2.4cqi,2.2rem)]">
                <SlideContext.Provider
                  value={{
                    index: position.index,
                    count: position.count,
                    step: position.step,
                    theme,
                    refresh,
                    measure: stage.measure,
                    titles: position.titles,
                    goTo: position.goTo
                  }}
                >
                  <DeckComponentsContext.Provider value={deckComponents}>
                    <Slides components={deckComponents} />
                  </DeckComponentsContext.Provider>

                  {/* The contents sit over the stage, not over the whole deck,
                      so the bar — and the control that opened them — stays
                      put. They are a control, not slide content, so a long
                      list may scroll where a slide never would (R17). */}
                  {contents.open && (
                    <ContentsDialog panelRef={contents.panelRef} onClose={contents.close} />
                  )}
                </SlideContext.Provider>
              </div>

              <DeckBar
                index={position.index}
                count={position.count}
                step={position.step}
                stepCount={position.stepCount}
                mode={present.mode}
                contentsOpen={contents.open}
                contentsButtonRef={contents.buttonRef}
                onPrev={position.prev}
                onNext={position.next}
                onToggleContents={contents.toggle}
                onTogglePresent={present.mode === 'present' ? present.exitPresent : present.present}
              />
            </div>

            {/* Announced on every position change so a screen reader user knows
                where they are in the deck (N1). */}
            <p className="live sr-only" aria-live="polite">
              Slide {position.index + 1} of {position.count}
              {position.stepCount > 1 ? `, step ${position.step + 1} of ${position.stepCount}` : ''}
            </p>
          </>,
          shadow
        )}
    </div>
  )
})

export default Deck
