/**
 * Present mode: the same deck on the whole screen.
 *
 * Covers R6 (one slide at a time, filling the screen, keyboard navigation, a
 * way out), R7 (the reader keeps their place) and R9 (presenting must not
 * silently fail in a browser without the Fullscreen API).
 */
import { expect, test, type Page } from '@playwright/test'
import { DEMO, deck, fullScreen, hostExitPresent, hostPresentButton, hostStatus, state } from './helpers'

/** Enter present mode the way a reader would: the button inside the deck. */
const enterPresent = (page: Page) => fullScreen(page)

test.beforeEach(async ({ page }) => {
  await page.goto(DEMO)
  await expect(deck(page)).toHaveAttribute('data-mode', 'embedded')
  await expect(page.locator('#deck section.slide')).toHaveCount(3)
  await page.locator('#deck section.slide[data-active] h1').first().click()
})

test.describe('present mode', () => {
  test('takes over the screen and shows one slide', async ({ page }) => {
    const viewport = page.viewportSize()
    await enterPresent(page)

    await expect(deck(page)).toHaveAttribute('data-mode', 'present')
    const presenting = await state(page)

    expect(presenting.visible).toEqual([0])
    expect(presenting.counter).toBe('1 / 3')
    expect(presenting.surface.position).toBe('fixed')
    expect(presenting.surface.width).toBeCloseTo(viewport?.width ?? 0, 0)
    expect(presenting.surface.height).toBeCloseTo(viewport?.height ?? 0, 0)
    expect(presenting.surface.top).toBe(0)
    expect(presenting.surface.left).toBe(0)
    /* The host keeps the box the deck came from, so the page behind is not
       disturbed — see the R7 test below. */
    expect(presenting.box.height).toBeGreaterThan(0)
  })

  test('is driven by the keyboard (R6, N1)', async ({ page }) => {
    await enterPresent(page)

    await page.keyboard.press('ArrowRight')
    await expect(page.locator('#deck .counter')).toHaveText('2 / 3')

    await page.keyboard.press('ArrowRight')
    await expect(page.locator('#deck .counter')).toHaveText('3 / 3')
    await expect(page.locator('#deck .live')).toHaveText('Slide 3 of 3')

    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('#deck .counter')).toHaveText('2 / 3')

    await page.keyboard.press('Home')
    await expect(page.locator('#deck .counter')).toHaveText('1 / 3')

    await page.keyboard.press('End')
    await expect(page.locator('#deck .counter')).toHaveText('3 / 3')

    await page.keyboard.press('PageUp')
    await expect(page.locator('#deck .counter')).toHaveText('2 / 3')
  })

  test('keeps the reader in their place: same slide, same scroll offset (R7)', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 100_000))
    const leftAt = await page.evaluate(() => window.scrollY)
    expect(leftAt).toBeGreaterThan(0)

    await page.keyboard.press('ArrowRight')
    expect((await state(page)).index).toBe(1)

    await enterPresent(page)
    await expect(deck(page)).toHaveAttribute('data-mode', 'present')
    await page.keyboard.press('ArrowRight')
    expect((await state(page)).index).toBe(2)

    await page.keyboard.press('Escape')

    await expect(deck(page)).toHaveAttribute('data-mode', 'embedded')
    /* Back on the slide that was being presented... */
    expect((await state(page)).index).toBe(2)
    /* ...and the page is exactly where it was left. */
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(leftAt)
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('')
  })

  test('keeps focus inside itself while presenting (N1)', async ({ page }) => {
    await enterPresent(page)

    const stops: string[] = []
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      stops.push(await page.evaluate(() => {
        const host = document.querySelector('#deck') as HTMLElement
        const inside = host.shadowRoot?.activeElement
        if (inside) return `deck:${inside.getAttribute('aria-label') ?? inside.textContent?.trim()}`
        return document.activeElement === host ? 'deck:itself' : 'OUTSIDE'
      }))
    }

    expect(stops).not.toContain('OUTSIDE')
    expect(stops.some((stop) => stop.startsWith('deck:'))).toBe(true)
  })

  test('still presents when the browser has no Fullscreen API (R9)', async ({ page }) => {
    /* No Fullscreen API in this browser: a fixed overlay is all there is. */
    await page.addInitScript(() => {
      delete (Element.prototype as unknown as Record<string, unknown>)['requestFullscreen']
    })
    await page.reload()
    await expect(deck(page)).toHaveAttribute('data-mode', 'embedded')

    const viewport = page.viewportSize()
    await enterPresent(page)

    const presenting = await state(page)
    expect(presenting.mode).toBe('present')
    expect(presenting.visible).toEqual([0])
    expect(presenting.surface.width).toBeCloseTo(viewport?.width ?? 0, 0)
    expect(presenting.surface.height).toBeCloseTo(viewport?.height ?? 0, 0)

    /* Slides are still reachable, and Escape still gets out. */
    await page.keyboard.press('ArrowRight')
    expect((await state(page)).index).toBe(1)
    await page.keyboard.press('Escape')
    await expect(deck(page)).toHaveAttribute('data-mode', 'embedded')
  })

  test('respects reduced motion (N1)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await enterPresent(page)

    await expect(page.locator('#deck section.slide[data-active]')).toHaveCSS('animation-name', 'none')

    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('#deck section.slide[data-active]')).toHaveCSS('animation-name', 'sd-enter')
  })

  test('leaves fullscreen behind when the host says so (R6, R10)', async ({ page }) => {
    await hostPresentButton(page).click()
    await expect(deck(page)).toHaveAttribute('data-mode', 'present')
    await expect(hostStatus(page)).toHaveText('present')

    /* The host's own logic ends the presentation — a presenting deck covers
       the page, so there is nothing left to click. */
    await hostExitPresent(page)

    await expect(deck(page)).toHaveAttribute('data-mode', 'embedded')
    await expect(hostStatus(page)).toHaveText('embedded')
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull()
  })
})
