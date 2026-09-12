import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { DeckView, type DeckComponent, type DeckMode } from './deck'
import { styles } from './styles'

export const TAG_NAME = 'saburto-deck'

/** Fired whenever the deck enters or leaves present mode (R10). */
export const MODE_CHANGE_EVENT = 'saburto-deck-mode-change'

export interface DeckModule {
  /** The compiled MDX file. */
  Component: DeckComponent
  /** `export const slideCount` injected by the build step. */
  slideCount: number
  /** Frontmatter, if the deck has any. */
  meta?: Record<string, unknown>
}

const noop = () => {}

/**
 * `<saburto-deck>` — a deck shown one slide at a time, either in the host's
 * box (embedded) or on the whole screen (present).
 *
 * The element owns the mode and the slide position, and is the host page's
 * whole programmatic surface (R10). React is used purely to draw that state.
 */
export class SaburtoDeckElement extends HTMLElement {
  static deck: DeckModule | undefined

  #shadow: ShadowRoot
  #mount: HTMLDivElement
  #root: Root
  #mode: DeckMode = 'embedded'
  #index = 0

  /* Captured on entering present mode, restored on leaving it (R7, N2). */
  #scrollY = 0
  #rootOverflow = ''
  #previousFocus: HTMLElement | null = null

  /* Whether we are the ones holding native fullscreen, so an unrelated
     fullscreenchange elsewhere cannot knock the deck out of present mode. */
  #holdsFullscreen = false

  /* Re-fits the slide whenever the deck's box changes size. */
  #boxObserver = new ResizeObserver(() => this.#fitStage())

  constructor() {
    super()
    this.#shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = styles

    this.#mount = document.createElement('div')
    this.#mount.className = 'mount'

    this.#shadow.append(style, this.#mount)
    this.#root = createRoot(this.#mount)
  }

  get mode(): DeckMode {
    return this.#mode
  }

  get slideIndex(): number {
    return this.#index
  }

  get slideCount(): number {
    return SaburtoDeckElement.deck?.slideCount ?? 0
  }

  get deckTitle(): string | undefined {
    const title = SaburtoDeckElement.deck?.meta?.['title']
    return typeof title === 'string' ? title : undefined
  }

  connectedCallback() {
    /* Focusable, so the deck can be tabbed to and then driven by the keyboard
       while it is embedded in a page. */
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0
    this.dataset['mode'] = this.#mode
    this.#syncLabel()
    this.addEventListener('keydown', this.#onKeyDown)
    this.#render()
  }

  disconnectedCallback() {
    this.removeEventListener('keydown', this.#onKeyDown)
    this.#boxObserver.disconnect()
  }

  /** Show the deck on the whole screen (R6). */
  present() {
    this.#setMode('present')
  }

  /** Return the deck to its place in the page, where the reader left it (R7). */
  exitPresent() {
    this.#setMode('embedded')
  }

  togglePresent() {
    this.#mode === 'present' ? this.exitPresent() : this.present()
  }

  next() {
    this.goTo(this.#index + 1)
  }

  prev() {
    this.goTo(this.#index - 1)
  }

  goTo(index: number) {
    if (this.slideCount === 0) return
    const clamped = Math.max(0, Math.min(index, this.slideCount - 1))
    if (clamped === this.#index) return
    this.#index = clamped
    this.#render()
    this.dispatchEvent(
      new CustomEvent('saburto-deck-slide-change', {
        detail: { index: this.#index, count: this.slideCount },
        bubbles: true,
        composed: true
      })
    )
  }

  #setMode(mode: DeckMode) {
    if (mode === this.#mode) return

    /* Where the reader is, noted before the mode changes anything. */
    if (mode === 'present') this.#rememberPlace()

    this.#mode = mode
    this.dataset['mode'] = mode

    if (mode === 'present') this.#enterPresent()
    else this.#leavePresent()

    this.#render()
    this.dispatchEvent(
      new CustomEvent(MODE_CHANGE_EVENT, {
        detail: { mode, index: this.#index, count: this.slideCount },
        bubbles: true,
        composed: true
      })
    )
  }

  /**
   * Remember the reader's place (R7).
   *
   * Read before anything about the layout changes. The host element itself
   * stays in the page's flow while presenting (only the deck inside it goes
   * full screen), so the page's height survives — but native fullscreen does
   * make the document unscrollable and clamps the offset to 0 while it lasts,
   * and a reader who scrolled to slide nine should come back to slide nine.
   */
  #rememberPlace() {
    this.#scrollY = window.scrollY
    this.#rootOverflow = document.documentElement.style.overflow
    this.#previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }

  #enterPresent() {
    if (!this.isConnected) return

    /* Freeze the page behind the overlay, so presenting cannot scroll the host
       page out from under the deck. Restored verbatim on the way back. */
    document.documentElement.style.overflow = 'hidden'

    this.focus({ preventScroll: true })

    /* Native fullscreen is a bonus, not a requirement: it hides the browser
       chrome where it exists. When it is missing or refused, the fixed overlay
       alone is already a full-screen presentation (R9). */
    const request = this.requestFullscreen?.bind(this)
    if (request) {
      request({ navigationUI: 'hide' })
        .then(() => {
          if (this.#mode === 'present') {
            this.#holdsFullscreen = true
            document.addEventListener('fullscreenchange', this.#onFullscreenChange)
          } else {
            void document.exitFullscreen().catch(noop)
          }
        })
        .catch(noop)
    }
  }

  #leavePresent() {
    document.removeEventListener('fullscreenchange', this.#onFullscreenChange)

    if (this.#holdsFullscreen || document.fullscreenElement === this) {
      this.#holdsFullscreen = false
      void document.exitFullscreen().catch(noop)
    }

    if (this.isConnected) {
      /* Same scroll offset and same scrollability as on the way in (R7). */
      document.documentElement.style.overflow = this.#rootOverflow
      this.#restoreScroll(this.#scrollY)
    }

    /* Back to the deck itself, so the keyboard keeps driving it in the page. */
    this.#previousFocus?.focus({ preventScroll: true })
    this.#previousFocus = null
  }

  /**
   * Puts the page back at the offset it was at.
   *
   * Native fullscreen tears down asynchronously: for a frame or two the page
   * still reports no scrollable height and silently clamps whatever offset we
   * ask for. So keep asking, briefly, until the page can honour it — and then
   * stop, rather than fighting the reader for control of their own page.
   */
  #restoreScroll(target: number, frames = 12) {
    if (window.scrollY === target) return
    window.scrollTo(0, target)
    if (window.scrollY === target || frames <= 0) return
    requestAnimationFrame(() => this.#restoreScroll(target, frames - 1))
  }

  /* The browser leaves fullscreen on its own for Escape and on iPad for the
     Done button; leaving fullscreen therefore means leaving present mode. */
  #onFullscreenChange = () => {
    if (!document.fullscreenElement && this.#mode === 'present') {
      this.exitPresent()
    }
  }

  /* This listener sits on the host, so it only ever sees keys typed while
     focus is inside the deck. In embedded mode that is exactly the rule we
     want: the deck does not steal the page's arrow keys (N2). */
  #onKeyDown = (event: KeyboardEvent) => {
    const presenting = this.#mode === 'present'

    switch (event.key) {
      case 'Escape':
        if (!presenting) return
        event.preventDefault()
        this.exitPresent()
        return
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
      case ' ':
        event.preventDefault()
        this.next()
        return
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        event.preventDefault()
        this.prev()
        return
      case 'Home':
        event.preventDefault()
        this.goTo(0)
        return
      case 'End':
        event.preventDefault()
        this.goTo(this.slideCount - 1)
        return
      case 'Tab':
        /* Focus is only contained while presenting; embedded, Tab should be
           able to leave the deck and carry on through the page. */
        if (presenting) this.#keepFocusInside(event)
        return
      default:
        return
    }
  }

  /** Tab cycles through the deck and never reaches the page behind it (N2). */
  #keepFocusInside(event: KeyboardEvent) {
    const focusable = Array.from(
      this.#shadow.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => !element.closest('[inert]'))

    const first = focusable.at(0)
    const last = focusable.at(-1)
    if (!first || !last) {
      event.preventDefault()
      this.focus({ preventScroll: true })
      return
    }

    /* `activeElement` is null when the host itself holds focus. */
    const active = this.#shadow.activeElement
    if (event.shiftKey && (active === null || active === first)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (active === last || active === null)) {
      event.preventDefault()
      first.focus()
    }
  }

  #syncLabel() {
    const title = this.deckTitle
    if (title && !this.hasAttribute('aria-label')) this.setAttribute('aria-label', title)
  }

  #render() {
    const deck = SaburtoDeckElement.deck
    if (!deck) return

    /* Drawn synchronously, so the deck can be measured and fitted in the same
       turn as the state change that caused it. */
    flushSync(() => {
      this.#root.render(
        createElement(DeckView, {
          Component: deck.Component,
          mode: this.#mode,
          index: this.#index,
          count: deck.slideCount,
          onPrev: () => this.prev(),
          onNext: () => this.next(),
          onToggleFullscreen: () => this.togglePresent()
        })
      )
    })

    this.#boxObserver.observe(this.#shadow.querySelector('.deck') ?? this)
    this.#fitStage()
  }

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
  #fitStage = () => {
    const stage = this.#shadow.querySelector<HTMLElement>('.stage')
    const slide = stage?.querySelector<HTMLElement>('section.slide[data-active]')
    if (!stage || !slide) return

    stage.style.removeProperty('font-size')
    const style = getComputedStyle(stage)
    const room =
      stage.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom)
    const start = Number.parseFloat(style.fontSize)
    if (!(room > 0) || !(start > 0)) return

    let size = start
    for (let pass = 0; pass < 5; pass++) {
      const needed = slide.scrollHeight
      if (needed <= room) return
      size *= Math.sqrt(room / needed)
      stage.style.fontSize = `${size}px`
    }
  }
}

/**
 * Register a compiled deck as `<saburto-deck>`. Called by the per-deck entry
 * the build step produces; host pages only ever see the tag.
 */
export function defineDeck(deck: DeckModule): void {
  SaburtoDeckElement.deck = deck
  if (!customElements.get(TAG_NAME)) customElements.define(TAG_NAME, SaburtoDeckElement)
}

declare global {
  interface HTMLElementTagNameMap {
    'saburto-deck': SaburtoDeckElement
  }
}
