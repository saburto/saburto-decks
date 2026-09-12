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
import { deckStyles } from './styles'

const noop = () => {}

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
  goTo(index: number): void
}

export interface DeckProps extends HTMLAttributes<HTMLDivElement> {
  /** The compiled deck file: `import slides from './my-deck.mdx'`. */
  slides: DeckComponent
  /** Which slide to start on. */
  defaultSlide?: number
  theme?: DeckTheme
  /** Told when the slide changes, so a host can show where the reader is. */
  onSlideChange?: (index: number, count: number) => void
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
  { slides: Slides, defaultSlide = 0, theme = 'light', onSlideChange, onModeChange, className, style, ...rest },
  ref
) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [shadow, setShadow] = useState<ShadowRoot | null>(null)
  const [mode, setMode] = useState<DeckMode>('embedded')
  const [index, setIndex] = useState(defaultSlide)
  const [count, setCount] = useState(0)

  /* Mirrors of the state, for the listeners and callbacks that outlive a
     render and must not read a stale closure. */
  const modeRef = useRef(mode)
  const indexRef = useRef(index)
  const countRef = useRef(count)
  const changeSlide = useRef(onSlideChange)
  const changeMode = useRef(onModeChange)
  changeSlide.current = onSlideChange
  changeMode.current = onModeChange

  /* Where the reader was, captured before present mode disturbs anything. */
  const place = useRef({ scrollY: 0, overflow: '', focus: null as HTMLElement | null })
  const holdsFullscreen = useRef(false)

  /* The shadow root is part of the contract (R8), so it is created once and
     the deck is portalled into it. */
  useIsomorphicLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    setShadow(host.shadowRoot ?? host.attachShadow({ mode: 'open' }))
  }, [])

  const goTo = useCallback((next: number) => {
    const total = countRef.current
    if (total === 0) return
    const clamped = Math.max(0, Math.min(next, total - 1))
    if (clamped === indexRef.current) return
    indexRef.current = clamped
    setIndex(clamped)
    changeSlide.current?.(clamped, total)
  }, [])

  const next = useCallback(() => goTo(indexRef.current + 1), [goTo])
  const prev = useCallback(() => goTo(indexRef.current - 1), [goTo])

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

  useImperativeHandle(ref, () => ({ present, exitPresent, next, prev, goTo }), [
    present,
    exitPresent,
    next,
    prev,
    goTo
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
   * square too: one correction by the square root lands very close, and a
   * couple more passes settle it. Each pass re-measures, so text that re-wraps
   * as it shrinks is accounted for.
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
    for (let pass = 0; pass < 5; pass++) {
      const needed = slide.scrollHeight
      if (needed <= room) return
      size *= Math.sqrt(room / needed)
      stage.style.fontSize = `${size}px`
    }
  }, [shadow])

  /* Learn how many slides the deck file has, keep the current one in range,
     and fit the type — after every render, before the browser paints. */
  useIsomorphicLayoutEffect(() => {
    if (!shadow) return
    const total = shadow.querySelectorAll('section.slide').length
    countRef.current = total
    setCount((current) => (current === total ? current : total))
    setIndex((current) => {
      const clamped = Math.max(0, Math.min(current, total - 1))
      indexRef.current = clamped
      return clamped === current ? current : clamped
    })
    fitStage()
  })

  /* A host page can resize the deck's box at any time. */
  useEffect(() => {
    const box = shadow?.querySelector('.deck')
    if (!box) return
    const observer = new ResizeObserver(() => fitStage())
    observer.observe(box)
    return () => observer.disconnect()
  }, [shadow, fitStage])

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
    >
      {shadow &&
        createPortal(
          <>
            <style>{deckStyles}</style>

            <div className="deck">
              {/* Re-keyed per slide so the entrance animation replays. */}
              <div className="stage" key={index}>
                <SlideContext.Provider value={{ index, count }}>
                  <Slides components={{ Slide }} />
                </SlideContext.Provider>
              </div>

              <div className="bar" role="toolbar" aria-label="Deck controls">
                <button type="button" onClick={prev} disabled={index <= 0} aria-label="Previous slide">
                  ‹
                </button>
                <span className="counter" aria-hidden="true">
                  {count > 0 ? `${index + 1} / ${count}` : ''}
                </span>
                <button
                  type="button"
                  onClick={next}
                  disabled={count === 0 || index >= count - 1}
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
            </p>
          </>,
          shadow
        )}
    </div>
  )
})
