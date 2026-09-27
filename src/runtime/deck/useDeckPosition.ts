/**
 * Where the reader is in the deck (R2, R12, R17): which slide, and which step
 * of it, plus everything that moves them.
 *
 * All of the arithmetic is `../steps`: this hook is the React end of it — the
 * state, the refs that callbacks read so they never act on a stale position,
 * and the layout effect that reads the slides out of the shadow root and keeps
 * the position inside them. Reading the slides is what makes the deck's own
 * count and its table of contents follow the file (R17, R18).
 */
import { useCallback, useRef, useState, type RefObject } from 'react'
import { contentsLabel, headingText, sameOutline, type ContentsSlide } from '../contents'
import {
  countSteps,
  resolvePosition,
  stepBack,
  stepForward,
  type Position,
  type StepsAt
} from '../steps'

export interface DeckPositionOptions {
  shadow: ShadowRoot | null
  /** Which slide to start on. */
  defaultSlide?: number
  onSlideChange?: (index: number, count: number) => void
  onStepChange?: (step: number, stepCount: number) => void
}

export interface DeckPosition {
  index: number
  count: number
  step: number
  stepCount: number
  /** The deck's table of contents: each slide's name and its own second-level
   * headings, in order (R17). */
  outline: ContentsSlide[]
  /** The refs the deck's listeners read, so they never act on a stale value. */
  indexRef: RefObject<number>
  countRef: RefObject<number>
  stepRef: RefObject<number>
  stepCountRef: RefObject<number>
  /** The slide at a deck position, or `null` when there is none. */
  slideAt: (position: number) => Element | null
  /** Moves to a slide and a step in one committed change, telling the host
   * which of the two actually moved. */
  goTo: (index: number, step?: number) => void
  goToStep: (step: number) => void
  next: () => void
  prev: () => void
  /**
   * Reads the deck's slides out of the shadow root: their count, their
   * headings, and where the current position now falls. Returns the active
   * slide, for the caller to show the step on and to fit. Must be called from
   * a layout effect that runs after every render, before paint.
   */
  sync: () => Element | null
}

export function useDeckPosition({
  shadow,
  defaultSlide = 0,
  onSlideChange,
  onStepChange
}: DeckPositionOptions): DeckPosition {
  const [index, setIndex] = useState(defaultSlide)
  const [count, setCount] = useState(0)
  const [step, setStep] = useState(0)
  const [stepCount, setStepCount] = useState(0)
  const [outline, setOutline] = useState<ContentsSlide[]>([])

  /* Mirrors of the state, for the listeners and callbacks that outlive a
     render and must not read a stale closure. */
  const indexRef = useRef(index)
  const countRef = useRef(count)
  const stepRef = useRef(step)
  const stepCountRef = useRef(stepCount)
  const changeSlide = useRef(onSlideChange)
  const changeStep = useRef(onStepChange)
  changeSlide.current = onSlideChange
  changeStep.current = onStepChange

  const slides = useCallback(
    (): Element[] => Array.from(shadow?.querySelectorAll('section.slide') ?? []),
    [shadow]
  )

  const slideAt = useCallback(
    (position: number): Element | null => slides()[position] ?? null,
    [slides]
  )

  /** How many steps a slide has: the longest run of steps among its code
   * blocks and its diagrams (R12). */
  const stepsAt = useCallback<StepsAt>((position) => countSteps(slideAt(position)), [slideAt])

  const applyPosition = useCallback(
    (nextIndex: number, nextStep: number) => {
      const total = countRef.current
      if (total === 0) return

      const next = resolvePosition({ index: nextIndex, step: nextStep }, total, stepsAt)
      const steps = stepsAt(next.index)

      const indexMoved = next.index !== indexRef.current
      const stepMoved = next.step !== stepRef.current || steps !== stepCountRef.current

      indexRef.current = next.index
      stepRef.current = next.step
      stepCountRef.current = steps

      if (indexMoved) {
        setIndex(next.index)
        changeSlide.current?.(next.index, total)
      }
      if (stepMoved) {
        setStep(next.step)
        setStepCount(steps)
        changeStep.current?.(next.step, steps)
      }
    },
    [stepsAt]
  )

  const goTo = useCallback(
    (nextIndex: number, nextStep = 0) => applyPosition(nextIndex, nextStep),
    [applyPosition]
  )
  const goToStep = useCallback(
    (nextStep: number) => applyPosition(indexRef.current, nextStep),
    [applyPosition]
  )

  /* Next walks the current slide's steps before it leaves the slide; previous
     walks them back, and steps back onto the last step of the slide before
     this one — the reader always moves one position, never two (R12). */
  const next = useCallback(() => {
    const at: Position = stepForward(
      { index: indexRef.current, step: stepRef.current },
      countRef.current,
      stepsAt
    )
    applyPosition(at.index, at.step)
  }, [applyPosition, stepsAt])

  const prev = useCallback(() => {
    const at: Position = stepBack(
      { index: indexRef.current, step: stepRef.current },
      countRef.current,
      stepsAt
    )
    applyPosition(at.index, at.step)
  }, [applyPosition, stepsAt])

  const sync = useCallback((): Element | null => {
    const all = slides()
    const total = all.length
    countRef.current = total
    setCount((current) => (current === total ? current : total))

    /* The contents' entries follow the slides themselves: each is named by the
       slide's own first heading, a slide without one is named by its number,
       and the slide's own second-level headings sit under it (R17). */
    const nextOutline = all.map((slide, position) => {
      const heading = slide.querySelector('h1, h2, h3, h4, h5, h6')
      const sections = Array.from(slide.querySelectorAll('h2'))
        .filter((element) => element !== heading)
        .map((element) => headingText(element.textContent))
        .filter((text): text is string => text !== null)
      return { title: contentsLabel(heading?.textContent, position), sections }
    })
    setOutline((current) => (sameOutline(current, nextOutline) ? current : nextOutline))

    const position = Math.max(0, Math.min(indexRef.current, total - 1))
    indexRef.current = position
    setIndex((current) => (current === position ? current : position))

    const active = all[position] ?? null
    const stepTotal = countSteps(active)
    stepCountRef.current = stepTotal
    setStepCount((current) => (current === stepTotal ? current : stepTotal))

    const at = Math.max(0, Math.min(stepRef.current, stepTotal - 1))
    stepRef.current = at
    setStep((current) => (current === at ? current : at))

    return active
  }, [slides])

  return {
    index,
    count,
    step,
    stepCount,
    outline,
    indexRef,
    countRef,
    stepRef,
    stepCountRef,
    slideAt,
    goTo,
    goToStep,
    next,
    prev,
    sync
  }
}
