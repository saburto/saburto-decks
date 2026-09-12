/**
 * The second host: a plain React app, with no Astro anywhere.
 *
 * The point is that a deck is a React component and nothing more. Same
 * `Deck`, same deck file, a different host — and the same promises, including
 * the one that matters most in a real page: the deck's styles and the page's
 * styles stay out of each other's way (R8).
 */
import { expect, test } from '@playwright/test'
import { hostExitPresent, hostStatus } from './helpers'

const DEMO = 'http://127.0.0.1:4174/'

test.beforeEach(async ({ page }) => {
  await page.goto(DEMO)
  await expect(page.locator('#deck')).toHaveAttribute('data-mode', 'embedded')
  await expect(page.locator('#deck section.slide')).toHaveCount(3)
})

test.describe('a deck in a React page', () => {
  test('renders the deck, one slide at a time', async ({ page }) => {
    await expect(page.locator('#deck .counter')).toHaveText('1 / 3')
    await expect(page.locator('#deck section.slide[data-active] h1')).toHaveText('Saburto Decks')

    await page.locator('#deck .bar button[aria-label="Next slide"]').click()
    await expect(page.locator('#deck .counter')).toHaveText('2 / 3')
  })

  test('is isolated from the host page in both directions (R8)', async ({ page }) => {
    /* The host page styles h1 and p loudly; the deck ignores it. */
    await expect(page.locator('.wrap > h1')).toHaveCSS('text-transform', 'uppercase')
    await expect(page.locator('#deck section.slide[data-active] h1')).toHaveCSS('text-transform', 'none')
    await expect(page.locator('#deck section.slide[data-active] h1')).not.toHaveCSS('color', 'rgb(220, 20, 60)')

    /* And the host's own appearance is untouched by the deck being there. */
    const snapshot = () =>
      page.evaluate(() => {
        const paragraph = getComputedStyle(document.querySelector('.wrap > section > p') as HTMLElement)
        return [paragraph.color, paragraph.borderLeftWidth, paragraph.fontFamily]
      })
    const withDeck = await snapshot()
    await page.evaluate(() => document.querySelector('#deck')?.remove())
    expect(await snapshot()).toEqual(withDeck)
  })

  test('presents from the host, and is told about it (R6, R10)', async ({ page }) => {
    const viewport = page.viewportSize()
    await page.locator('#present').click()

    await expect(page.locator('#deck')).toHaveAttribute('data-mode', 'present')
    await expect(hostStatus(page)).toHaveText('present')

    const surface = await page.evaluate(() => {
      const rect = document.querySelector('#deck')!.shadowRoot!.querySelector('.deck')!.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    })
    expect(surface.width).toBeCloseTo(viewport?.width ?? 0, 0)
    expect(surface.height).toBeCloseTo(viewport?.height ?? 0, 0)

    await page.keyboard.press('ArrowRight')
    await expect(hostStatus(page)).toHaveText('present · slide 2/3')

    await hostExitPresent(page)
    await expect(page.locator('#deck')).toHaveAttribute('data-mode', 'embedded')
    await expect(hostStatus(page)).toHaveText('embedded · slide 2/3')
  })

  test('keeps the reader in their place across a presentation (R7)', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 100_000))
    const leftAt = await page.evaluate(() => window.scrollY)
    expect(leftAt).toBeGreaterThan(0)

    await page.locator('#present').click()
    await expect(page.locator('#deck')).toHaveAttribute('data-mode', 'present')
    await page.keyboard.press('Escape')

    await expect(page.locator('#deck')).toHaveAttribute('data-mode', 'embedded')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(leftAt)
  })

  test('the host decides the theme (R8)', async ({ page }) => {
    await expect(page.locator('#deck .deck')).toHaveCSS('background-color', 'rgb(255, 255, 255)')

    await page.locator('.theme button[data-theme="dark"]').click()

    await expect(page.locator('#deck')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('#deck .deck')).toHaveCSS('background-color', 'rgb(17, 19, 24)')
  })
})
