/**
 * Helpers for driving the demo deck from a test.
 *
 * The deck renders inside a shadow root, which Playwright's CSS locators
 * pierce on their own — `page.locator('section.slide')` finds the slides. Only
 * the measurements need to reach into the shadow root by hand.
 */
import type { Page } from '@playwright/test'

export const DEMO = '/demo/'

/** The host element the deck registered. */
export const deck = (page: Page) => page.locator('#deck')

export interface DeckState {
  mode: 'embedded' | 'present'
  index: number
  count: number
  /** The type size the deck settled on, in px. */
  typePx: number
  /** How many px of the slide do not fit the stage. Must never be positive. */
  clipped: number
  /** How many px of the slide do not fit the stage horizontally. */
  clippedHorizontally: number
  counter: string
  live: string
  /** Slides actually painted, by index. */
  visible: number[]
  /** The deck's own box, in CSS px. */
  box: { width: number; height: number }
  /** The presenting surface: the deck's box, or the viewport when presenting. */
  surface: { width: number; height: number; top: number; left: number; position: string }
  pageScrollY: number
}

export async function state(page: Page): Promise<DeckState> {
  return page.evaluate(() => {
    const host = document.querySelector('#deck') as HTMLElement & {
      mode: 'embedded' | 'present'
      slideIndex: number
      slideCount: number
    }
    const shadow = host.shadowRoot as ShadowRoot
    const stage = shadow.querySelector('.stage') as HTMLElement
    const active = shadow.querySelector('section.slide[data-active]') as HTMLElement
    const deckEl = shadow.querySelector('.deck') as HTMLElement
    const box = host.getBoundingClientRect()
    const surface = deckEl.getBoundingClientRect()

    const visible: number[] = []
    for (const slide of shadow.querySelectorAll<HTMLElement>('section.slide')) {
      if (getComputedStyle(slide).display !== 'none') visible.push(Number(slide.dataset['index']))
    }

    return {
      mode: host.mode,
      index: host.slideIndex,
      count: host.slideCount,
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
      pageScrollY: window.scrollY
    }
  })
}

/** Steps forward n slides using the deck's own controls, as a reader would. */
export async function nextSlide(page: Page, times = 1): Promise<void> {
  const button = page.locator('.bar button[aria-label="Next slide"]')
  for (let i = 0; i < times; i++) await button.click()
}

/** Where focus currently is, described in a way a test can assert on. */
export async function focusPath(page: Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.querySelector('#deck') as HTMLElement
    const shadow = host.shadowRoot as ShadowRoot
    const inside = shadow.activeElement
    if (inside) return `deck:${inside.getAttribute('aria-label') ?? inside.textContent?.trim() ?? ''}`
    if (document.activeElement === host) return 'deck:itself'
    const outside = document.activeElement as HTMLElement | null
    if (!outside || outside === document.body) return 'page:body'
    return `page:${outside.id || outside.tagName.toLowerCase()}`
  })
}
