/**
 * Arrows: two things on a slide joined by a hand-drawn line (R19), and an arrow
 * that is one of the slide's steps, counted and navigated with the rest (R12).
 *
 * The demo deck's "Arrows" slide (its last) is two columns. The left holds a
 * passage with three key words; the slide opens on that text alone, and then
 * each of the three blocks on the right appears on its own step, with an arrow
 * drawn from the block to the word it explains. The arrows are drawn in the
 * stage beside the slide rather than in the slide itself, so the drawing is
 * looked for there.
 */
import { expect, test, type Page } from '@playwright/test'
import { DEMO, deck, goTo, state } from './helpers'

const ARROWS = 22

/** One arrow's drawing. The three are in the stage, in the order written. */
const arrow = (page: Page, nth: number) => page.locator('#deck .sd-arrow').nth(nth)
const paths = (page: Page, nth: number) => arrow(page, nth).locator('path')

/** A block the demo slide marks, by its `data-id`. */
const marked = (page: Page, id: string) =>
  page.locator(`#deck section.slide[data-active] [data-id=${id}]`)

/** The blocks the slide makes appear, in order. */
const appear = (page: Page, nth: number) =>
  page.locator('#deck section.slide[data-active] .sd-motion[data-motion="appear"]').nth(nth)

/** The slide, on the step its first arrow appears on. */
const goToFirstArrow = async (page: Page): Promise<void> => {
  await goTo(page, ARROWS)
  await page.locator('#deck').focus()
  await page.keyboard.press('ArrowRight')
}

/** The box the strokes of one arrow cover, in viewport coordinates. */
async function drawingBox(page: Page, nth: number) {
  return page.evaluate((index) => {
    const root = document.querySelector('#deck')?.shadowRoot
    const svg = root?.querySelectorAll('.sd-arrow')[index]
    if (!svg) return null
    const rects = Array.from(svg.querySelectorAll('path')).map((path) =>
      path.getBoundingClientRect()
    )
    if (rects.length === 0) return null
    const left = Math.min(...rects.map((rect) => rect.left))
    const top = Math.min(...rects.map((rect) => rect.top))
    const right = Math.max(...rects.map((rect) => rect.right))
    const bottom = Math.max(...rects.map((rect) => rect.bottom))
    return { x: left, y: top, width: right - left, height: bottom - top }
  }, nth)
}

/** Whether two measurements are the same place, to a hand-drawn line's slack. */
const near = (a: number, b: number, slack = 25) => Math.abs(a - b) <= slack

test.beforeEach(async ({ page }) => {
  await page.goto(DEMO)
  await expect(deck(page)).toHaveAttribute('data-mode', 'embedded')
})

test.describe('arrows', () => {
  test('opens on the text alone, and takes up the arrows on the next step (R12, R19)', async ({
    page
  }) => {
    await goTo(page, ARROWS)
    await page.locator('#deck').focus()

    /* The first step is the left passage and nothing else: no arrow is drawn,
       and no block has appeared. */
    const arrived = await state(page)
    expect(arrived.stepCount).toBe(4)
    await expect(page.locator('#deck .step-dot')).toHaveCount(4)
    await expect(page.locator('#deck .live')).toHaveText('Slide 23 of 24, step 1 of 4')
    for (const nth of [0, 1, 2]) {
      await expect(paths(page, nth)).toHaveCount(0)
      await expect(appear(page, nth)).toHaveCSS('opacity', '0')
    }

    /* The next step draws the first arrow and shows the block it explains —
       and the slide keeps the type size it settled on, because the column the
       blocks live in held its height all along (R16, R19). */
    await page.keyboard.press('ArrowRight')
    let now = await state(page)
    expect(now.index).toBe(ARROWS)
    expect(now.step).toBe(1)
    expect(now.typePx).toBeCloseTo(arrived.typePx, 5)
    await expect(paths(page, 0)).not.toHaveCount(0)
    await expect(paths(page, 1)).toHaveCount(0)
    await expect(appear(page, 0)).toHaveCSS('opacity', '1')
    await expect(appear(page, 1)).toHaveCSS('opacity', '0')

    /* Each step after that brings one more pair. */
    await page.keyboard.press('ArrowRight')
    now = await state(page)
    expect(now.step).toBe(2)
    await expect(paths(page, 1)).not.toHaveCount(0)
    await expect(paths(page, 2)).toHaveCount(0)
    await expect(appear(page, 1)).toHaveCSS('opacity', '1')

    await page.keyboard.press('ArrowRight')
    now = await state(page)
    expect(now.step).toBe(3)
    await expect(paths(page, 2)).not.toHaveCount(0)
    await expect(appear(page, 2)).toHaveCSS('opacity', '1')
    await expect(page.locator('#deck .live')).toHaveText('Slide 23 of 24, step 4 of 4')

    /* The arrows demo is no longer the deck's last slide, so Next leaves it
       for the page after it; the deck's own end is where Next has nowhere
       further to go, and stays put. */
    await page.keyboard.press('ArrowRight')
    expect((await state(page)).index).toBe(ARROWS + 1)
    await page.keyboard.press('ArrowRight')
    expect((await state(page)).index).toBe(ARROWS + 1)

    /* Previous takes the reader back onto the arrows demo's last step, and the
       third arrow down again with its block. */
    await page.keyboard.press('ArrowLeft')
    expect((await state(page)).index).toBe(ARROWS)
    expect((await state(page)).step).toBe(3)
    await page.keyboard.press('ArrowLeft')
    expect((await state(page)).step).toBe(2)
    await expect(paths(page, 2)).toHaveCount(0)
    await expect(appear(page, 2)).toHaveCSS('opacity', '0')
  })

  test('draws a callout arrow from a block to the word it explains (R19)', async ({ page }) => {
    await goToFirstArrow(page)

    const first = arrow(page, 0)
    /* It is decoration: the words already carry the meaning. */
    await expect(first).toHaveAttribute('aria-hidden', 'true')
    /* It is drawn, not ruled: rough.js breaks the line into several strokes. */
    expect(await paths(page, 0).count()).toBeGreaterThan(1)

    /* The head is on the word, and the tail on the block's own edge: the
       drawing spans the distance between them. */
    const word = await marked(page, 'arrow-word-file').boundingBox()
    const block = await marked(page, 'arrow-file').boundingBox()
    const drawn = await drawingBox(page, 0)
    expect(word && block && drawn).toBeTruthy()
    expect(near(drawn!.x, word!.x + word!.width)).toBe(true)
    expect(near(drawn!.x + drawn!.width, block!.x)).toBe(true)
  })

  test('bows the line, and fills the head, as asked (R19)', async ({ page }) => {
    await goToFirstArrow(page)

    /* The first is a plain line with one head. */
    await expect(arrow(page, 0).locator('g.sd-arrow-head')).toHaveCount(1)

    /* The third is dashed — the dash scales with its width of 2: 8 on, 6 off —
       with a filled polygon head and a bow. */
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')

    const dashed = arrow(page, 2).locator('path[stroke="currentColor"][stroke-dasharray]')
    expect(await dashed.count()).toBeGreaterThan(0)
    await expect(dashed.first()).toHaveAttribute('stroke-dasharray', '8 6')
    await expect(arrow(page, 2).locator('path[fill="currentColor"]')).not.toHaveCount(0)
  })

  test('is decoration: it takes no room in the slide (R19)', async ({ page }) => {
    await goTo(page, ARROWS)

    /* The arrow's place in the slide is an empty box, and the slide still
       fits its box at a readable size. */
    const anchors = page.locator('#deck section.slide[data-active] .sd-arrow-anchor')
    await expect(anchors).toHaveCount(3)
    await expect(anchors.first()).toBeHidden()

    const measured = await state(page)
    expect(measured.clipped).toBeLessThanOrEqual(0)
    expect(measured.clippedHorizontally).toBeLessThanOrEqual(0)
  })

  test('follows the deck, and the theme (N1, R19)', async ({ page }) => {
    await goToFirstArrow(page)

    const stroke = () =>
      page.evaluate(() => {
        const root = document.querySelector('#deck')?.shadowRoot
        const path = root
          ?.querySelectorAll('.sd-arrow')[0]
          ?.querySelector('path[stroke="currentColor"]')
        return path ? getComputedStyle(path).stroke : ''
      })

    /* `color="accent"` is the deck's accent, drawn in the deck's palette. */
    await expect.poll(stroke).toBe('rgb(47, 111, 237)')
    await page.locator('.theme button[data-theme="dark"]').click()
    await expect.poll(stroke).toBe('rgb(122, 162, 247)')
  })

  test('draws immediately when the reader prefers reduced motion (N1, R19)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(DEMO)
    await goToFirstArrow(page)

    const line = arrow(page, 0).locator('path[stroke="currentColor"]').first()
    await expect(line).toHaveCSS('animation-name', 'none')

    /* With no such preference, the arrow draws itself in. */
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(DEMO)
    await goToFirstArrow(page)
    await expect(arrow(page, 0).locator('.sd-arrow-stroke').first()).toHaveCSS(
      'animation-name',
      'sd-arrow-draw'
    )
  })
})
