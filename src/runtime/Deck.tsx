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
import { contentsLabel } from './contents'
import { Contents, ContentsEntries } from './Contents'
import { Agenda } from './Agenda'
import { Block } from './Block'
import { Bullets } from './Bullets'
import { Canvas } from './Canvas'
import { Columns } from './Columns'
import { Cover } from './Cover'
import { Figure } from './Figure'
import { Grid } from './Grid'
import { Mark } from './Mark'
import { Mermaid } from './Mermaid'
import { Appear, Move } from './Motion'
import { Stack } from './Stack'
import { deckStyles } from './styles'

const noop = () => {}

/** The deck's own controls share one button style. */
const barButton =
  '[font:inherit] min-h-[2.4em] px-[0.9em] py-[0.3em] text-inherit bg-sd-surface border border-sd-border rounded-[0.5em] cursor-pointer disabled:opacity-[0.35] disabled:cursor-default focus-visible:outline-2 focus-visible:outline-sd-accent focus-visible:outline-offset-2'

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
  /* The same shadow root, held where a callback can always see it. The state
     drives rendering; this ref is for the host's handle, which must not go
     stale: a host may hold the handle it was first given, and `goTo(index,
     step)` would silently lose its step if that handle still saw no root
     (R10). */
  const rootRef = useRef<ShadowRoot | null>(null)
  const [shadow, setShadow] = useState<ShadowRoot | null>(null)
  const [mode, setMode] = useState<DeckMode>('embedded')
  const [index, setIndex] = useState(defaultSlide)
  const [count, setCount] = useState(0)
  /* A slide's steps are its code blocks' ordered highlight states (R12). Every
     slide has at least one (the state it arrives in), so the dots only appear
     when there is more than one. */
  const [step, setStep] = useState(0)
  const [stepCount, setStepCount] = useState(0)
  /* The deck's table of contents and its entries, built from the slides'
     headings (R17). It is reachable from any slide, so whether it is open is
     the deck's state, not a slide's. */
  const [contentsOpen, setContentsOpen] = useState(false)
  const [titles, setTitles] = useState<string[]>([])

  /* Mirrors of the state, for the listeners and callbacks that outlive a
     render and must not read a stale closure. */
  const modeRef = useRef(mode)
  const indexRef = useRef(index)
  const countRef = useRef(count)
  const stepRef = useRef(step)
  const stepCountRef = useRef(stepCount)
  /* Read by the host's key and click listeners, which outlive a render and
     must not act on a stale value (R17). */
  const contentsOpenRef = useRef(contentsOpen)
  contentsOpenRef.current = contentsOpen
  const panelRef = useRef<HTMLDivElement | null>(null)
  const contentsButtonRef = useRef<HTMLButtonElement | null>(null)
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
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    rootRef.current = root
    setShadow(root)
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
    (position: number): Element | null => rootRef.current?.querySelectorAll('section.slide')[position] ?? null,
    []
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

  /* The contents are opened and dismissed by the reader, from any slide
     (R17). Dismissing them returns focus to the control that opened them, so
     the keyboard never drops out of the deck (N1). */
  const openContents = useCallback(() => setContentsOpen(true), [])
  const closeContents = useCallback(() => {
    setContentsOpen(false)
    contentsButtonRef.current?.focus({ preventScroll: true })
  }, [])
  const toggleContents = useCallback(() => setContentsOpen((open) => !open), [])

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
    if (slide.scrollHeight <= room) return

    /* The largest type size at which the slide still fits. A single correction
       does not do it: a run of text grows with the square of the size, while a
       diagram in a column may be capped by that column and not grow at all, so
       no one curve fits every slide. A bisection measures the real height at
       each size and keeps the largest that fits. */
    let low = 0
    let high = start
    for (let pass = 0; pass < 14; pass++) {
      const middle = (low + high) / 2
      stage.style.fontSize = `${middle}px`
      if (slide.scrollHeight <= room) low = middle
      else high = middle
    }
    stage.style.fontSize = `${low}px`
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
      /* A diagram shown whole reveals nothing; a `{build}` diagram keeps every
         element and brings the current step's part forward (R14). */
      const built = diagram.hasAttribute('data-build')
      for (const element of diagram.querySelectorAll<SVGElement>('[data-sd-step]')) {
        const step = Number(element.getAttribute('data-sd-step'))
        if (built) element.classList.toggle('sd-current', step === at)
        else element.classList.toggle('sd-shown', step <= at)
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

    /* The contents' entries follow the slides themselves: each is named by the
       slide's own first heading, and a slide without one is named by its
       number (R17). */
    const nextTitles = Array.from(slides, (slide, position) =>
      contentsLabel(slide.querySelector('h1, h2, h3, h4, h5, h6')?.textContent, position)
    )
    setTitles((current) =>
      current.length === nextTitles.length && current.every((title, at) => title === nextTitles[at])
        ? current
        : nextTitles
    )

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

  /* Opening the contents puts focus on the entry for the slide the reader is
     on — the keyboard goes straight to where they are (R17, N1). */
  useIsomorphicLayoutEffect(() => {
    if (!contentsOpen) return
    const entries = panelRef.current?.querySelectorAll<HTMLElement>('[data-toc-entry]')
    if (!entries?.length) return
    ;(entries[indexRef.current] ?? entries[0])?.focus({ preventScroll: true })
  }, [contentsOpen])

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
      /* While the contents are open they own the keyboard: the reader is
         choosing a slide, not stepping through one, so navigation keys do not
         reach the deck (R17). */
      if (contentsOpenRef.current) {
        const panel = panelRef.current
        const buttons = Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])
        const entries = Array.from(panel?.querySelectorAll<HTMLElement>('[data-toc-entry]') ?? [])
        const active = shadow?.activeElement ?? null
        const entryAt = active ? entries.indexOf(active as HTMLElement) : -1

        switch (event.key) {
          case 'Escape':
          case 'o':
          case 'O':
            event.preventDefault()
            closeContents()
            return
          case 'Tab': {
            /* The contents are one control: Tab stays within them until they
               are dismissed. */
            const first = buttons.at(0)
            const last = buttons.at(-1)
            if (!first || !last) return
            if (event.shiftKey && (active === first || active === null)) {
              event.preventDefault()
              last.focus()
            } else if (!event.shiftKey && (active === last || active === null)) {
              event.preventDefault()
              first.focus()
            }
            return
          }
          case 'ArrowDown':
            event.preventDefault()
            ;(entries[Math.min(entryAt + 1, entries.length - 1)] ?? entries[0])?.focus()
            return
          case 'ArrowUp':
            event.preventDefault()
            ;(entries[Math.max(entryAt - 1, 0)] ?? entries.at(-1))?.focus()
            return
          case 'Home':
            event.preventDefault()
            entries.at(0)?.focus()
            return
          case 'End':
            event.preventDefault()
            entries.at(-1)?.focus()
            return
          default:
            return
        }
      }

      const presenting = modeRef.current === 'present'

      switch (event.key) {
        case 'Escape':
          if (!presenting) return
          event.preventDefault()
          exitPresent()
          return
        case 'o':
        case 'O':
          event.preventDefault()
          openContents()
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
  }, [shadow, exitPresent, goTo, next, prev, openContents, closeContents])

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

            <div className="deck absolute inset-0 flex flex-col [container-type:size] bg-sd-bg text-sd-fg font-sans text-base leading-normal text-start">
              {/* The slide itself carries the entrance animation through
                  [data-active]; changing the key here would remount every
                  slide — and every diagram — on each move. */}
              <div className="stage flex-auto min-h-0 grid place-content-center relative overflow-hidden px-[6cqi] py-[4cqi] text-[clamp(0.9rem,2.4cqi,2.2rem)]">
                <SlideContext.Provider value={{ index, count, step, theme, refresh, measure, titles, goTo }}>
                  <Slides components={{ Slide, Mermaid, Mark, Appear, Move, Canvas, Cover, Agenda, Columns, Grid, Block, Stack, Figure, Bullets, Contents }} />

                  {/* The contents sit over the stage, not over the whole deck,
                      so the bar — and the control that opened them — stays
                      put. They are a control, not slide content, so a long
                      list may scroll where a slide never would (R17). */}
                  {contentsOpen && (
                    <div
                      className="contents absolute inset-0 z-[1] flex items-center justify-center p-2 text-[clamp(0.75rem,1.7cqi,1.05rem)] bg-[color-mix(in_srgb,var(--sd-bg)_85%,transparent)]"
                      role="dialog"
                      aria-modal="true"
                      aria-label="Table of contents"
                      ref={panelRef}
                      onClick={(event) => {
                        if (event.target === event.currentTarget) closeContents()
                      }}
                    >
                      <div className="contents-panel flex flex-col w-[min(100%,30em)] max-h-full px-[1em] pt-[0.8em] pb-[0.9em] text-sd-fg bg-sd-bg border border-sd-border rounded-[0.6em] shadow-[0_0.5em_2em_rgba(0,0,0,0.18)]">
                        <div className="contents-head flex items-baseline justify-between gap-[1em] mb-[0.4em]">
                          <p className="contents-heading m-0 text-sd-muted text-[0.8em] font-semibold tracking-[0.08em] uppercase" id="sd-contents-heading">
                            Contents
                          </p>
                          <button
                            type="button"
                            className="contents-close px-[0.35em] py-[0.1em] [font:inherit] text-[1.1em] leading-none text-inherit bg-transparent border-0 rounded-[0.35em] cursor-pointer hover:bg-sd-surface focus-visible:outline-2 focus-visible:outline-sd-accent focus-visible:outline-offset-2"
                            aria-label="Close contents"
                            onClick={closeContents}
                          >
                            ×
                          </button>
                        </div>
                        <ContentsEntries
                          labelledBy="sd-contents-heading"
                          onChoose={closeContents}
                          className="min-h-0 overflow-auto"
                        />
                      </div>
                    </div>
                  )}
                </SlideContext.Provider>
              </div>

              <div
                className="bar flex-none flex gap-[0.4rem] items-center justify-center px-3 py-2 text-[clamp(0.75rem,1.7cqi,1.05rem)] opacity-60 transition-opacity duration-150 hover:opacity-100 focus-within:opacity-100"
                role="toolbar"
                aria-label="Deck controls"
              >
                <button
                  type="button"
                  className={barButton}
                  onClick={prev}
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
                  onClick={next}
                  disabled={count === 0 || (index >= count - 1 && step >= stepCount - 1)}
                  aria-label="Next slide"
                >
                  ›
                </button>
                <button
                  type="button"
                  className={barButton}
                  ref={contentsButtonRef}
                  onClick={toggleContents}
                  aria-expanded={contentsOpen}
                  aria-haspopup="dialog"
                >
                  Contents
                </button>
                <button
                  type="button"
                  className={barButton}
                  onClick={mode === 'present' ? exitPresent : present}
                >
                  {mode === 'present' ? 'Exit' : 'Full screen'}
                </button>
              </div>
            </div>

            {/* Announced on every position change so a screen reader user knows
                where they are in the deck (N1). */}
            <p className="live sr-only" aria-live="polite">
              Slide {index + 1} of {count}
              {stepCount > 1 ? `, step ${step + 1} of ${stepCount}` : ''}
            </p>
          </>,
          shadow
        )}
    </div>
  )
})
