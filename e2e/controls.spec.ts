/**
 * The deck's control bar (R22).
 *
 * The bar is shown by default — previous, next, the reader's position and the
 * contents — and never dimmed away. A host that renders its own controls can
 * hide it, and hiding it takes nothing else with it: the keyboard still moves
 * the deck, the contents still open, and dismissing them still returns the
 * keyboard to the deck.
 */
import { expect, test, type Page } from '@playwright/test'
import { DEMO, deck, focusPath, state } from './helpers'

const bar = (page: Page) => page.locator('#deck .bar')

test.beforeEach(async ({ page }) => {
  await page.goto(DEMO)
  await expect(deck(page)).toHaveAttribute('data-mode', 'embedded')
  await expect(page.locator('#deck section.slide')).toHaveCount(24)
})

test.describe('the deck’s controls', () => {
  test('are shown by default, and never dimmed away (R22)', async ({ page }) => {
    await expect(bar(page)).toBeVisible()
    await expect(bar(page)).toHaveCSS('opacity', '1')
    await expect(page.locator('#deck .bar button[aria-label="Previous slide"]')).toBeVisible()
    await expect(page.locator('#deck .bar button[aria-label="Next slide"]')).toBeVisible()
    await expect(page.locator('#deck .counter')).toHaveText('1 / 24')
    await expect(page.locator('#deck .bar button', { hasText: 'Contents' })).toBeVisible()
  })

  test('can be hidden by the host, and the deck still navigates (R22)', async ({ page }) => {
    await page.locator('#controls').click()
    await expect(bar(page)).toHaveCount(0)

    /* The keyboard still moves the deck. */
    await page.locator('#deck').focus()
    await page.keyboard.press('ArrowRight')
    expect((await state(page)).index).toBe(1)
    await expect(page.locator('#deck .live')).toHaveText(/^Slide 2 of 24/)

    /* The contents still open, and dismissing them returns focus to the deck,
       since there is no control to return it to. */
    await page.keyboard.press('o')
    await expect(page.locator('#deck .contents-sidebar')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('#deck .contents-sidebar')).toBeHidden()
    expect(await focusPath(page)).toBe('deck:itself')
  })

  test('come back when the host shows them again (R22)', async ({ page }) => {
    await page.locator('#controls').click()
    await expect(bar(page)).toHaveCount(0)

    await page.locator('#controls').click()
    await expect(bar(page)).toBeVisible()
    await expect(page.locator('#deck .counter')).toHaveText('1 / 24')
  })
})
