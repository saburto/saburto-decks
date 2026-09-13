/**
 * Helpers for driving the demo deck from a test.
 *
 * The deck renders inside a shadow root, which Playwright's CSS locators
 * pierce on their own — `page.locator('section.slide')` finds the slides. Only
 * the measurements need to reach into the shadow root by hand.
 */
import type { Page } from '@playwright/test'

export const DEMO = '/'

/** The element the deck is rendered into, in the host page. */
export const deck = (page: Page) => page.locator('#deck')

/** The deck's own control bar (inside the shadow root). */
export const bar = (page: Page) => page.locator('#deck .bar')

/** Advances one slide using the deck's own control, as a reader would. */
export const nextSlide = (page: Page) => page.locator('#deck .bar button[aria-label="Next slide"]').click()

/** The deck's own way in and out of present mode. */
export const fullScreen = (page: Page) => page.locator('#deck .bar button').last().click()

/** Jumps straight to a slide, the way a host page's own logic would (R10).
 * Stepping through a deck by keyboard is a different thing, and is tested as
 * such — this is for getting to a particular slide regardless of its steps. */
export const goTo = (page: Page, index: number) =>
  page.evaluate((at) => (window as unknown as { deck?: { goTo(index: number): void } }).deck?.goTo(at), index)

/** The host page's way in and out of present mode (R10). */
export const hostPresentButton = (page: Page) => page.locator('#present')

/** What the host page was told, as it displays it. */
export const hostStatus = (page: Page) => page.locator('#status')

/** The host page asking to leave present mode programmatically — what a host's
 * own logic does, since a presenting deck covers the page it is in. */
export const hostExitPresent = (page: Page) =>
  page.evaluate(() => (window as unknown as { deck?: { exitPresent(): void } }).deck?.exitPresent())

export interface DeckState {
  mode: 'embedded' | 'present'
  theme: string | null
  /** The slide actually on screen. */
  index: number
  count: number
  /** Which step of the current slide, and how many that slide has (R12). */
  step: number
  stepCount: number
  /** How many lines the current step highlights. */
  activeLines: number
  /** How many code blocks the current step takes off the slide (R12). */
  hiddenCode: number
  /** The type size the deck settled on, in px. */
  typePx: number
  /** How many px of the slide do not fit the stage. Must never be positive. */
  clipped: number
  clippedHorizontally: number
  counter: string
  live: string
  visible: number[]
  /** The deck's own box in the page. */
  box: { width: number; height: number }
  /** The presenting surface: the deck's box, or the viewport when presenting. */
  surface: { width: number; height: number; top: number; left: number; position: string }
  pageScrollY: number
  hostStatus: string
}

export async function state(page: Page): Promise<DeckState> {
  return page.evaluate(() => {
    const host = document.querySelector('#deck') as HTMLElement
    const shadow = host.shadowRoot as ShadowRoot
    const stage = shadow.querySelector('.stage') as HTMLElement
    const deckEl = shadow.querySelector('.deck') as HTMLElement
    const active = shadow.querySelector<HTMLElement>('section.slide[data-active]')
    const slides = Array.from(shadow.querySelectorAll<HTMLElement>('section.slide'))
    const box = host.getBoundingClientRect()
    const surface = deckEl.getBoundingClientRect()

    const visible: number[] = []
    for (const slide of slides) {
      if (getComputedStyle(slide).display !== 'none') visible.push(Number(slide.dataset['index']))
    }

    return {
      mode: host.dataset['mode'] as 'embedded' | 'present',
      theme: host.dataset['theme'] ?? null,
      index: active ? Number(active.dataset['index']) : -1,
      count: slides.length,
      step: Number(host.dataset['step'] ?? 0),
      stepCount: Number(host.dataset['steps'] ?? 1),
      activeLines: shadow.querySelectorAll('section.slide[data-active] .line.highlighted').length,
      hiddenCode: shadow.querySelectorAll('section.slide[data-active] pre.shiki[hidden]').length,
      typePx: Number.parseFloat(getComputedStyle(stage).fontSize),
      clipped: stage.scrollHeight - stage.clientHeight,
      clippedHorizontally: stage.scrollWidth - stage.clientWidth,
      counter: shadow.querySelector('.counter')?.textContent ?? '',
      live: shadow.querySelector('.live')?.textContent ?? '',
      visible,
      box: { width: box.width, height: box.height },
      surface: {
        width: surface.width,
        height: surface.height,
        top: surface.top,
        left: surface.left,
        position: getComputedStyle(deckEl).position
      },
      pageScrollY: window.scrollY,
      hostStatus: document.querySelector('#status')?.textContent ?? ''
    }
  })
}

/** Adds (or replaces) a stylesheet in the host page, as a host page would. */
export async function hostCss(page: Page, css: string): Promise<void> {
  await page.evaluate((content) => {
    document.getElementById('probe')?.remove()
    const style = document.createElement('style')
    style.id = 'probe'
    style.textContent = content
    document.head.append(style)
  }, css)
}

/** Where focus currently is, described in a way a test can assert on. */
export async function focusPath(page: Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.querySelector('#deck') as HTMLElement
    const inside = host.shadowRoot?.activeElement
    if (inside) return `deck:${inside.getAttribute('aria-label') ?? inside.textContent?.trim() ?? ''}`
    if (document.activeElement === host) return 'deck:itself'
    const outside = document.activeElement as HTMLElement | null
    if (!outside || outside === document.body) return 'page:body'
    return `page:${outside.tagName.toLowerCase()}`
  })
}
