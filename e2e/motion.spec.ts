/**
 * Motion: an object can arrive on a step and move on one (R16). The demo deck's
 * last slide has both — a line that arrives on the second step, and a line that
 * moves on the third — so these are the steps these tests drive.
 */
import { expect, test, type Page } from '@playwright/test'
import { DEMO, deck, goTo, nextSlide, state } from './helpers'

const MOTION = 9

const appear = (page: Page) => page.locator('#deck section.slide[data-active] .sd-motion[data-motion="appear"]')
const move = (page: Page) => page.locator('#deck section.slide[data-active] .sd-motion[data-motion="move"]')

/** How far an object sits from where it started, in px. */
async function offsetFrom(page: Page, from: number): Promise<number> {
  const box = await move(page).boundingBox()
  return Math.round((box?.x ?? 0) - from)
}

/** How far a passage sits below the top of its own slide. Measured against the
 * slide rather than the viewport, so the slide's own entrance animation — a
 * short rise — does not come into it. */
async function belowSlideTop(page: Page): Promise<number> {
  const slide = await page.locator('#deck section.slide[data-active]').boundingBox()
  const text = await page.locator('#deck section.slide[data-active] p').last().boundingBox()
  return Math.round((text?.y ?? 0) - (slide?.y ?? 0))
}

test.beforeEach(async ({ page }) => {
  await page.goto(DEMO)
  await expect(deck(page)).toHaveAttribute('data-mode', 'embedded')
})

test.describe('motion', () => {
  test('an object arrives on its step, and is counted and announced with the rest (R12, R16)', async ({ page }) => {
    await goTo(page, MOTION)
    await expect(page.locator('#deck .counter')).toHaveText('10 / 10')

    /* The line that arrives and the line that moves are each a step, so the
       slide has three. */
    const waiting = await state(page)
    expect(waiting.stepCount).toBe(3)
    await expect(page.locator('#deck .step-dot')).toHaveCount(3)
    await expect(page.locator('#deck .live')).toHaveText('Slide 10 of 10, step 1 of 3')

    /* It is not shown yet, and it is kept out of the accessibility tree so it
       is not read out or focused while it cannot be seen (N1). */
    await expect(appear(page)).toHaveCSS('opacity', '0')
    await expect(appear(page)).toHaveAttribute('inert', '')

    /* Clicking the slide advances it, which is what "appears on click" means
       here — the same click that moves any other step on (R12). */
    await page.locator('#deck').focus()
    await page.locator('#deck section.slide[data-active] h2').click()

    expect((await state(page)).step).toBe(1)
    await expect(appear(page)).toHaveCSS('opacity', '1')
    await expect(appear(page)).not.toHaveAttribute('inert', '')
  })

  test('an object that has not arrived already occupies its place (R16)', async ({ page }) => {
    await goTo(page, MOTION)
    const waiting = await state(page)
    const textBefore = await belowSlideTop(page)

    /* Arriving changes what is shown, not where anything sits: the line has
       held its place all along, so the passage below it does not move and the
       type size the slide settled on does not change. */
    await nextSlide(page)
    expect((await state(page)).typePx).toBeCloseTo(waiting.typePx, 5)
    expect(await belowSlideTop(page)).toBe(textBefore)
  })

  test('an object moves on its step, and stepping back moves it back (R16)', async ({ page }) => {
    await goTo(page, MOTION)
    await page.locator('#deck').focus()

    const start = (await move(page).boundingBox())?.x ?? 0

    /* Two steps on: the line has arrived and the box has moved. */
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('#deck .live')).toHaveText('Slide 10 of 10, step 3 of 3')
    await expect.poll(() => offsetFrom(page, start)).toBe(120)

    /* One step back: the box returns to where it was, and the arrived line is
       still on the slide. */
    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('#deck .live')).toHaveText('Slide 10 of 10, step 2 of 3')
    await expect.poll(() => offsetFrom(page, start)).toBe(0)
    await expect(appear(page)).toHaveCSS('opacity', '1')

    /* Back to the slide's first step: the line that arrived is gone again. */
    await page.keyboard.press('ArrowLeft')
    await expect(appear(page)).toHaveCSS('opacity', '0')
  })

  test('a reader who prefers reduced motion gets the object in its place, with no animation (N1)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(DEMO)
    await expect(deck(page)).toHaveAttribute('data-mode', 'embedded')

    await goTo(page, MOTION)
    await page.locator('#deck').focus()
    await page.keyboard.press('ArrowRight')

    /* A quarter-second animation would still be running; with the preference
       set, the object is simply there. */
    await page.waitForTimeout(100)
    await expect(appear(page)).toHaveCSS('opacity', '1')
  })
})
