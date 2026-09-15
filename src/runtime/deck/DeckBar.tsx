/**
 * The deck's control bar (R6, R12, R17).
 *
 * Deliberately presentational: every value it shows and every control it
 * offers comes in as a prop, so it can be rendered and asserted on without a
 * shadow root, a browser, or a deck around it. What the buttons do — where
 * "next" goes, what leaving present mode means — belongs to the deck, not to
 * the bar.
 */
import type { RefObject } from 'react'
import type { DeckMode } from '../Slide'

/** The deck's own controls share one button style. */
export const barButton =
  '[font:inherit] min-h-[2.4em] px-[0.9em] py-[0.3em] text-inherit bg-sd-surface border border-sd-border rounded-[0.5em] cursor-pointer disabled:opacity-[0.35] disabled:cursor-default focus-visible:outline-2 focus-visible:outline-sd-accent focus-visible:outline-offset-2'

export interface DeckBarProps {
  index: number
  count: number
  step: number
  stepCount: number
  mode: DeckMode
  contentsOpen: boolean
  /** The control the contents return focus to when they are dismissed (N1). */
  contentsButtonRef?: RefObject<HTMLButtonElement | null>
  onPrev: () => void
  onNext: () => void
  onToggleContents: () => void
  onTogglePresent: () => void
}

export function DeckBar({
  index,
  count,
  step,
  stepCount,
  mode,
  contentsOpen,
  contentsButtonRef,
  onPrev,
  onNext,
  onToggleContents,
  onTogglePresent
}: DeckBarProps) {
  return (
    <div
      className="bar flex-none flex gap-[0.4rem] items-center justify-center px-3 py-2 text-[clamp(0.75rem,1.7cqi,1.05rem)] opacity-60 transition-opacity duration-150 hover:opacity-100 focus-within:opacity-100"
      role="toolbar"
      aria-label="Deck controls"
    >
      <button
        type="button"
        className={barButton}
        onClick={onPrev}
        disabled={index <= 0 && step <= 0}
        aria-label="Previous slide"
      >
        ‹
      </button>
      <span
        className="counter min-w-[4ch] text-center text-sd-muted [font-variant-numeric:tabular-nums]"
        aria-hidden="true"
      >
        {count > 0 ? `${index + 1} / ${count}` : ''}
      </span>
      {stepCount > 1 && (
        <span className="steps inline-flex gap-1 items-center" aria-hidden="true">
          {Array.from({ length: stepCount }, (_, position) => (
            <span
              key={position}
              className="step-dot w-[0.4em] h-[0.4em] rounded-full bg-sd-border data-[on]:bg-sd-accent"
              data-on={position === step ? '' : undefined}
            />
          ))}
        </span>
      )}
      <button
        type="button"
        className={barButton}
        onClick={onNext}
        disabled={count === 0 || (index >= count - 1 && step >= stepCount - 1)}
        aria-label="Next slide"
      >
        ›
      </button>
      <button
        type="button"
        className={barButton}
        ref={contentsButtonRef}
        onClick={onToggleContents}
        aria-expanded={contentsOpen}
        aria-haspopup="dialog"
      >
        Contents
      </button>
      <button type="button" className={barButton} onClick={onTogglePresent}>
        {mode === 'present' ? 'Exit' : 'Full screen'}
      </button>
    </div>
  )
}

export default DeckBar
