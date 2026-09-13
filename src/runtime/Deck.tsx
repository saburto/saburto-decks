import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes
} from 'react'
import { createPortal } from 'react-dom'
import { Slide, SlideContext, type DeckComponent, type DeckMode, type DeckTheme } from './Slide'
import { Mermaid } from './Mermaid'
import { deckStyles } from './styles'

const noop = () => {}

/** A `{hide}` step takes a code block, and the title bar above it, off the
 * slide — nothing about it is left behind. */
function setCodeHidden(block: HTMLElement, hidden: boolean): void {
  block.hidden = hidden
  const title = block.previousElementSibling
  if (title instanceof HTMLElement && title.classList.contains('sd-code-title')) title.hidden = hidden
}

/** The deck is server-rendered by Astro and hydrated on the client. Layout
 * effects only exist in a browser, so fall back to `useEffect` where there is
 * no DOM to lay out. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

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

/**
 * A deck: one slide at a time, in a box the host page sizes, or on the whole
 * screen.
 *
 * `<Deck slides={slides} />` is the whole integration. The deck renders inside
 * a shadow root of its own, so the host page's CSS cannot restyle it and its
 * CSS cannot leak out.
 */
export const Deck = forwardRef<DeckHandle, DeckProps>(function Deck(
  { slides: Slides, defaultSlide = 0, theme = 'light', onSlideChange, onStepChange, onModeChange, className, style, ...rest },
  ref
) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [shadow, setShadow] = useState<ShadowRoot | null>(null)
  const [mode, setMode] = useState<DeckMode>('embedded')
  const [index, setIndex] = useState(defaultSlide)
  const [count, setCount] = useState(0)
  /* A slide's steps are its code blocks' ordered highlight states (R12). Every
     slide has at least one (the state it arrives in), so the dots only appear
     when there is more than one. */
  const [step, setStep] = useState(0)
  const [stepCount, setStepCount] = useState(0)

  /* Mirrors of the state, for the listeners and callbacks that outlive a
     render and must not read a stale closure. */
  const modeRef = useRef(mode)
  const indexRef = useRef(index)
  const countRef = useRef(count)
  const stepRef = useRef(step)
  const stepCountRef = useRef(stepCount)
  const changeSlide = useRef(onSlideChange)
  const changeStep = useRef(onStepChange)
  const changeMode = useRef(onModeChange)
  changeSlide.current = onSlideChange
  changeStep.current = onStepChange
  changeMode.current = onModeChange

  /* Where the reader was, captured before present mode disturbs anything. */
  const place = useRef({ scrollY: 0, overflow: '', focus: null as HTMLElement | null })
  const holdsFullscreen = useRef(false)

  /* Content that arrives after its first render — a diagram Mermaid drew —
     asks the deck to look again, so it is measured and its step applied. */
  const [, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision((revision) => revision + 1), [])

  /* Where Mermaid builds and measures a diagram. It has to live in the light
     DOM — Mermaid finds it by id, which does not cross a shadow boundary —
     but it is fixed and invisible, so measuring a diagram never adds height to
     the host page and never shifts where the reader is (R7, R13). */
  const [measure, setMeasure] = useState<HTMLDivElement | null>(null)
  useIsomorphicLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const container = document.createElement('div')
    container.setAttribute('aria-hidden', 'true')
    container.style.cssText = `position: fixed; top: 0; left: 0; overflow: hidden; opacity: 0; pointer-events: none; width: ${host.clientWidth}px; height: ${host.clientHeight}px;`
    document.body.append(container)
    setMeasure(container)
    return () => container.remove()
  }, [])

  /* The shadow root is part of the contract (R8), so it is created once and
     the deck is portalled into it. */
  useIsomorphicLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    setShadow(host.shadowRoot ?? host.attachShadow({ mode: 'open' }))
  }, [])

  /** How many steps a slide has: the longest run of steps among its code
     blocks and its diagrams. A slide without stepping content still has the
     one state it arrives in. */
  const stepsIn = useCallback((slide: Element | null | undefined): number => {
    if (!slide) return 1
    let steps = 1
    for (const block of slide.querySelectorAll('[data-steps]')) {
      steps = Math.max(steps, Number(block.getAttribute('data-steps')) || 1)
    }
    return steps
  }, [])

  const slideAt = useCallback(
    (position: number): Element | null => shadow?.querySelectorAll('section.slide')[position] ?? null,
    [shadow]
  )

  /** Moves to a slide and a step in one committed change, telling the host
     which of the two actually moved. */
  const applyPosition = useCallback(
    (nextIndex: number, nextStep: number) => {
      const total = countRef.current
      if (total === 0) return

      const clampedIndex = Math.max(0, Math.min(nextIndex, total - 1))
      const stepTotal = stepsIn(slideAt(clampedIndex))
      const clampedStep = Math.max(0, Math.min(nextStep, stepTotal - 1))

      const indexMoved = clampedIndex !== indexRef.current
      const stepMoved = clampedStep !== stepRef.current || stepTotal !== stepCountRef.current

      indexRef.current = clampedIndex
      stepRef.current = clampedStep
      stepCountRef.current = stepTotal

      if (indexMoved) {
        setIndex(clampedIndex)
        changeSlide.current?.(clampedIndex, total)
      }
      if (stepMoved) {
        setStep(clampedStep)
        setStepCount(stepTotal)
        changeStep.current?.(clampedStep, stepTotal)
      }
    },
    [slideAt, stepsIn]
  )

  const goTo = useCallback((nextIndex: number, nextStep = 0) => applyPosition(nextIndex, nextStep), [applyPosition])
  const goToStep = useCallback((nextStep: number) => applyPosition(indexRef.current, nextStep), [applyPosition])

  /* Next walks the current slide's steps before it leaves the slide; previous
     walks them back, and steps back onto the last step of the slide before
     this one — the reader always moves one position, never two (R12). */
  const next = useCallback(() => {
    if (stepRef.current < stepCountRef.current - 1) applyPosition(indexRef.current, stepRef.current + 1)
    else if (indexRef.current < countRef.current - 1) applyPosition(indexRef.current + 1, 0)
  }, [applyPosition])

  const prev = useCallback(() => {
    if (stepRef.current > 0) applyPosition(indexRef.current, stepRef.current - 1)
    else if (indexRef.current > 0) applyPosition(indexRef.current - 1, stepsIn(slideAt(indexRef.current - 1)) - 1)
  }, [applyPosition, slideAt, stepsIn])

  /**
   * Puts the page back at the offset it was at.
   *
   * Native fullscreen tears down asynchronously: for a frame or two the page
   * still reports no scrollable height and silently clamps whatever offset we
   * ask for. So keep asking, briefly, until the page can honour it — and then
   * stop, rather than fighting the reader for control of their own page.
   */
  const restoreScroll = useCallback((target: number, frames = 12) => {
    if (window.scrollY === target) return
    window.scrollTo(0, target)
    if (window.scrollY === target || frames <= 0) return
    requestAnimationFrame(() => restoreScroll(target, frames - 1))
  }, [])

  const present = useCallback(() => {
    if (modeRef.current === 'present') return

    /* Read before anything about the layout changes: native fullscreen makes
       the document unscrollable and clamps the offset to 0 while it lasts. */
    place.current = {
      scrollY: window.scrollY,
      overflow: document.documentElement.style.overflow,
      focus: document.activeElement instanceof HTMLElement ? document.activeElement : null
    }

    modeRef.current = 'present'
    setMode('present')
    changeMode.current?.('present')

    document.documentElement.style.overflow = 'hidden'
    const host = hostRef.current
    host?.focus({ preventScroll: true })

    /* Native fullscreen is a bonus, not a requirement: it hides the browser
       chrome where it exists. When it is missing or refused, the fixed overlay
       alone is already a full-screen presentation (R9). */
    host?.requestFullscreen?.({ navigationUI: 'hide' })
      .then(() => {
        if (modeRef.current === 'present') holdsFullscreen.current = true
      })
      .catch(noop)
  }, [])

  const exitPresent = useCallback(() => {
    if (modeRef.current !== 'present') return

    modeRef.current = 'embedded'
    setMode('embedded')
    changeMode.current?.('embedded')

    if (holdsFullscreen.current || document.fullscreenElement === hostRef.current) {
      holdsFullscreen.current = false
      void document.exitFullscreen().catch(noop)
    }

    document.documentElement.style.overflow = place.current.overflow
    restoreScroll(place.current.scrollY)
    place.current.focus?.focus({ preventScroll: true })
  }, [restoreScroll])

  useImperativeHandle(ref, () => ({ present, exitPresent, next, prev, goTo, goToStep }), [
    present,
    exitPresent,
    next,
    prev,
    goTo,
    goToStep
  ])

  /* The browser leaves fullscreen on its own for Escape and on tablets for the
     Done button; leaving fullscreen therefore means leaving present mode. */
  useEffect(() => {
    if (mode !== 'present') return
    const onChange = () => {
      if (!document.fullscreenElement) exitPresent()
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [mode, exitPresent])

  /**
   * Shrinks the type until the current slide fits the deck's box.
   *
   * Nothing about a slide scrolls: a deck that had to be scrolled would not be
   * a deck. So the type gives way instead, and any slide fits any box — the
   * same slide in a 16:9 box in a page and on a full screen.
   *
   * A run of text occupies an area that grows with the square of the type
   * size, and the column width is independent of it, so height grows with the
   * square too: one correction by the square root lands very close. A block of
   * wrapping code is measured in whole lines, so it needs a few small
   * corrections after that. Each pass re-measures, so content that re-wraps as
   * it shrinks is accounted for.
   */
  const fitStage = useCallback(() => {
    const stage = shadow?.querySelector<HTMLElement>('.stage')
    const slide = stage?.querySelector<HTMLElement>('section.slide[data-active]')
    if (!stage || !slide) return

    stage.style.removeProperty('font-size')
    const computed = getComputedStyle(stage)
    const room =
      stage.clientHeight -
      Number.parseFloat(computed.paddingTop) -
      Number.parseFloat(computed.paddingBottom)
    const start = Number.parseFloat(computed.fontSize)
    if (!(room > 0) || !(start > 0)) return

    let size = start
    /* A run of text occupies an area that grows with the square of the type
       size, so one square-root correction lands close. A diagram grows with
       the type size itself — its width is a multiple of it — and correcting by
       the square root of a diagram's overflow would crawl towards fitting
       without reaching it, so a diagram takes the linear correction. */
    const hasDiagram = Boolean(slide.querySelector('.sd-mermaid'))
    for (let pass = 0; pass < 12; pass++) {
      const needed = slide.scrollHeight
      if (needed <= room) return
      size *= hasDiagram ? room / needed : Math.sqrt(room / needed)
      stage.style.fontSize = `${size}px`
    }
  }, [shadow])

  /** Shows the current step, Shiki's way: the lines whose `data-hl` names it
     carry `highlighted`, the block dims the rest, and a `{hide}` step takes
     the block off the slide altogether. A diagram is shown the same way, one
     of its marked elements at a time (R14). Only the active slide is touched —
     the others are hidden, and are brought up to date when they become
     active. Opacity and visibility do not change layout, so this needs no
     measure of its own; hiding a code block does, and `fitStage` follows
     this. */
  const applyStepHighlights = useCallback(() => {
    const active = shadow?.querySelector<HTMLElement>('section.slide[data-active]')
    if (!active) return
    for (const block of active.querySelectorAll<HTMLElement>('pre.shiki[data-steps]')) {
      const total = Number(block.getAttribute('data-steps')) || 1
      const at = Math.min(stepRef.current, total - 1)
      const hidden = (block.getAttribute('data-hide') ?? '').split(' ').includes(String(at))
      setCodeHidden(block, hidden)
      for (const line of block.querySelectorAll<HTMLElement>('.line')) {
        const steps = (line.getAttribute('data-hl') ?? '').split(' ')
        line.classList.toggle('highlighted', !hidden && steps.includes(String(at)))
      }
      block.classList.toggle('has-highlighted', !hidden)
    }
    for (const diagram of active.querySelectorAll<HTMLElement>('.sd-mermaid[data-steps]')) {
      const total = Number(diagram.getAttribute('data-steps')) || 1
      const at = Math.min(stepRef.current, total - 1)
      for (const element of diagram.querySelectorAll<SVGElement>('[data-sd-step]')) {
        element.classList.toggle('sd-shown', Number(element.getAttribute('data-sd-step')) <= at)
      }
    }
  }, [shadow])

  /* Learn how many slides the deck file has, keep the current slide and step
     in range, show the step, and fit the type — after every render, before
     the browser paints. */
  useIsomorphicLayoutEffect(() => {
    if (!shadow) return
    const slides = shadow.querySelectorAll('section.slide')
    const total = slides.length
    countRef.current = total
    setCount((current) => (current === total ? current : total))

    const position = Math.max(0, Math.min(indexRef.current, total - 1))
    indexRef.current = position
    setIndex((current) => (current === position ? current : position))

    const stepTotal = stepsIn(slides[position])
    stepCountRef.current = stepTotal
    setStepCount((current) => (current === stepTotal ? current : stepTotal))

    const at = Math.max(0, Math.min(stepRef.current, stepTotal - 1))
    stepRef.current = at
    setStep((current) => (current === at ? current : at))

    applyStepHighlights()
    fitStage()
  })

  /* A host page can resize the deck's box at any time. The measuring
     container follows it, so a diagram is laid out at the deck's own size. */
  useEffect(() => {
    const box = shadow?.querySelector('.deck')
    if (!box) return
    const follow = () => {
      const host = hostRef.current
      if (measure && host) {
        measure.style.width = `${host.clientWidth}px`
        measure.style.height = `${host.clientHeight}px`
      }
      fitStage()
    }
    const observer = new ResizeObserver(follow)
    observer.observe(box)
    return () => observer.disconnect()
  }, [shadow, fitStage, measure])

  /* Native rather than React's synthetic handler: this one must see keys typed
     anywhere inside the shadow root, and the host element is outside it. It
     only fires for keys typed while focus is inside the deck, which is exactly
     the rule we want — embedded, the deck does not steal the page's arrow keys
     (N1). */
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const keepFocusInside = (event: KeyboardEvent) => {
      const focusable = Array.from(
        shadow?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((element) => !element.closest('[inert]'))

      const first = focusable.at(0)
      const last = focusable.at(-1)
      if (!first || !last) {
        event.preventDefault()
        host.focus({ preventScroll: true })
        return
      }
      /* `activeElement` is null when the host itself holds focus. */
      const active = shadow?.activeElement ?? null
      if (event.shiftKey && (active === null || active === first)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || active === null)) {
        event.preventDefault()
        first.focus()
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const presenting = modeRef.current === 'present'

      switch (event.key) {
        case 'Escape':
          if (!presenting) return
          event.preventDefault()
          exitPresent()
          return
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          event.preventDefault()
          next()
          return
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          event.preventDefault()
          prev()
          return
        case 'Home':
          event.preventDefault()
          goTo(0)
          return
        case 'End':
          event.preventDefault()
          goTo(countRef.current - 1)
          return
        case 'Tab':
          /* Focus is only contained while presenting; embedded, Tab should be
             able to leave the deck and carry on through the page. */
          if (presenting) keepFocusInside(event)
          return
        default:
      }
    }

    host.addEventListener('keydown', onKeyDown)
    return () => host.removeEventListener('keydown', onKeyDown)
  }, [shadow, exitPresent, goTo, next, prev])

  /* Clicking the slide advances, as in Slidev (R12) — but the click that first
     focuses an unfocused deck only focuses it, or reaching for the deck's own
     controls would move the deck on. Links, form controls and selected text
     belong to the reader, not to the deck. */
  useEffect(() => {
    if (!shadow) return
    let wasFocused = false
    const onMouseDown = () => {
      wasFocused = shadow.activeElement !== null || document.activeElement === hostRef.current
    }
    const onClick = (event: Event) => {
      const target = event.target
      if (
        target instanceof Element &&
        target.closest('a, button, input, select, textarea, summary, [role="button"], [contenteditable="true"]')
      )
        return
      if (window.getSelection()?.toString()) return
      if (!wasFocused) return
      next()
    }
    shadow.addEventListener('mousedown', onMouseDown)
    shadow.addEventListener('click', onClick)
    return () => {
      shadow.removeEventListener('mousedown', onMouseDown)
      shadow.removeEventListener('click', onClick)
    }
  }, [shadow, next])

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
      data-mode={mode}
      data-theme={theme}
      data-step={step}
      data-steps={stepCount}
    >
      {shadow &&
        createPortal(
          <>
            <style>{deckStyles}</style>

            <div className="deck">
              {/* The slide itself carries the entrance animation through
                  [data-active]; changing the key here would remount every
                  slide — and every diagram — on each move. */}
              <div className="stage">
                <SlideContext.Provider value={{ index, count, theme, refresh, measure }}>
                  <Slides components={{ Slide, Mermaid }} />
                </SlideContext.Provider>
              </div>

              <div className="bar" role="toolbar" aria-label="Deck controls">
                <button
                  type="button"
                  onClick={prev}
                  disabled={index <= 0 && step <= 0}
                  aria-label="Previous slide"
                >
                  ‹
                </button>
                <span className="counter" aria-hidden="true">
                  {count > 0 ? `${index + 1} / ${count}` : ''}
                </span>
                {stepCount > 1 && (
                  <span className="steps" aria-hidden="true">
                    {Array.from({ length: stepCount }, (_, position) => (
                      <span key={position} className="step-dot" data-on={position === step ? '' : undefined} />
                    ))}
                  </span>
                )}
                <button
                  type="button"
                  onClick={next}
                  disabled={count === 0 || (index >= count - 1 && step >= stepCount - 1)}
                  aria-label="Next slide"
                >
                  ›
                </button>
                <button type="button" onClick={mode === 'present' ? exitPresent : present}>
                  {mode === 'present' ? 'Exit' : 'Full screen'}
                </button>
              </div>
            </div>

            {/* Announced on every position change so a screen reader user knows
                where they are in the deck (N1). */}
            <p className="live" aria-live="polite">
              Slide {index + 1} of {count}
              {stepCount > 1 ? `, step ${step + 1} of ${stepCount}` : ''}
            </p>
          </>,
          shadow
        )}
    </div>
  )
})
