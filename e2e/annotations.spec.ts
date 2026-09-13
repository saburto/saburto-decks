/**
 * Annotations: a passage can be marked with a hand-drawn emphasis (R15), and a
 * mark can be one of a slide's steps, counted and navigated with the rest
 * (R12).
 *
 * The demo deck marks three passages — the title, a line on the "Writing a
 * deck" slide, and two words on the "Presenting it" slide, one of them on a
 * step — so these are the slides the tests drive.
 */
import { expect, test, type Page } from '@playwright/test'
import { DEMO, deck, goTo, state } from './helpers'

const TITLE = 0
const WRITING = 1
const PRESENTING = 2

/** One kind of mark on the slide the reader is on. */
const ofType = (page: Page, type: string) =>
  page.locator(`#deck section.slide[data-active] .sd-mark[data-mark="${type}"]`)
/** The strokes rough-notation has actually drawn for a mark. */
const strokes = (page: Page, type: string) => ofType(page, type).locator('svg.rough-annotation path')

test.beforeEach(async ({ page }) => {
  await page.goto(DEMO)
  await expect(deck(page)).toHaveAttribute('data-mode', 'embedded')
})

test.describe('annotations', () => {
  test('draws a hand-drawn mark over the passage it wraps (R15)', async ({ page }) => {
    await goTo(page, TITLE)

    const highlighted = ofType(page, 'highlight')
    /* The words are the ones the author wrapped... */
    await expect(highlighted).toHaveText('one file')
    /* ...and a drawing lands on them. */
    await expect(strokes(page, 'highlight')).not.toHaveCount(0)
    /* It is decoration the words already carry: not in the accessibility tree. */
    await expect(ofType(page, 'highlight').locator('svg')).toHaveAttribute('aria-hidden', 'true')

    /* A highlight is a thick stroke behind the words, so it must not be drawn
       in the words' own colour — that would black them out. It uses the deck's
       translucent highlight colour instead. */
    const highlight = await page.evaluate(() => {
      const root = document.querySelector('#deck')?.shadowRoot
      const path = root?.querySelector('section.slide[data-active] .sd-mark[data-mark="highlight"] svg path')
      const deck = root?.querySelector('.deck')
      return {
        drawn: path ? getComputedStyle(path).stroke : '',
        declared: deck ? getComputedStyle(deck).getPropertyValue('--sd-highlight').trim() : '',
        text: deck ? getComputedStyle(deck).color : ''
      }
    })
    expect(highlight.drawn).toBe(highlight.declared)
    expect(highlight.drawn).not.toBe(highlight.text)

    const drawn = await page.evaluate(() => {
      const root = document.querySelector('#deck')?.shadowRoot
      const wrapper = root?.querySelector<HTMLElement>('section.slide[data-active] .sd-mark[data-mark="highlight"]')
      const words = wrapper?.querySelector('span')?.getBoundingClientRect()
      const path = wrapper?.querySelector('svg path')?.getBoundingClientRect()
      return { words, path }
    })

    expect(drawn.words?.width).toBeGreaterThan(0)
    expect(drawn.path?.width).toBeGreaterThan(drawn.words!.width * 0.5)
    /* It overlaps the words horizontally: the mark is on them, not beside. */
    expect(drawn.path!.x).toBeLessThanOrEqual(drawn.words!.right)
    expect(drawn.path!.right).toBeGreaterThanOrEqual(drawn.words!.x)
  })

  test('is decoration: the passage is on the slide either way (R15)', async ({ page }) => {
    await goTo(page, PRESENTING)

    const circled = ofType(page, 'circle')
    /* Its step has not been reached, so nothing is drawn... */
    await expect(circled).toHaveText('Escape')
    await expect(strokes(page, 'circle')).toHaveCount(0)
    /* ...but the word it marks is still there, and the slide still fits. */
    await expect(circled).toBeVisible()

    for (const slide of [TITLE, WRITING, PRESENTING]) {
      await goTo(page, slide)
      const measured = await state(page)
      expect(measured.clipped, `slide ${slide} clipped`).toBeLessThanOrEqual(0)
      expect(measured.clippedHorizontally, `slide ${slide} overflows`).toBeLessThanOrEqual(0)
    }
  })

  test('shows with the slide unless it is given a step', async ({ page }) => {
    await goTo(page, PRESENTING)

    const box = ofType(page, 'box')
    await expect(box).toHaveAttribute('data-steps', '1')
    await expect(strokes(page, 'box')).not.toHaveCount(0)

    await expect(ofType(page, 'circle')).toHaveAttribute('data-steps', '2')
  })

  test("is one of the slide's steps (R12, R15)", async ({ page }) => {
    await goTo(page, PRESENTING)
    await page.locator('#deck').focus()

    /* The box shows with the slide; the circle waits for step 2. */
    let now = await state(page)
    expect(now.step).toBe(0)
    expect(now.stepCount).toBe(2)
    await expect(strokes(page, 'box')).not.toHaveCount(0)
    await expect(strokes(page, 'circle')).toHaveCount(0)

    /* The bar counts it and announces it, like any other step. */
    await expect(page.locator('#deck .step-dot')).toHaveCount(2)
    await expect(page.locator('#deck .live')).toHaveText('Slide 3 of 10, step 1 of 2')

    await page.keyboard.press('ArrowRight')
    now = await state(page)
    expect(now.index, 'still on the slide').toBe(PRESENTING)
    expect(now.step).toBe(1)
    await expect(strokes(page, 'circle')).not.toHaveCount(0)
    await expect(page.locator('#deck .live')).toHaveText('Slide 3 of 10, step 2 of 2')

    /* Only after the last step does the reader leave. */
    await page.keyboard.press('ArrowRight')
    expect((await state(page)).index).toBe(3)

    /* Previous comes back to the slide's last step, with its mark drawn. */
    await page.keyboard.press('ArrowLeft')
    now = await state(page)
    expect(now.index).toBe(PRESENTING)
    expect(now.step).toBe(1)
    await expect(strokes(page, 'circle')).not.toHaveCount(0)
  })

  test('draws nothing for a slide the reader is not on (R15)', async ({ page }) => {
    await goTo(page, PRESENTING)
    await page.locator('#deck').focus()
    await page.keyboard.press('ArrowRight')
    await expect(strokes(page, 'circle')).not.toHaveCount(0)

    /* Move away: the title slide's mark is out of sight, and is taken down
       rather than left drawn against a hidden box. */
    await goTo(page, WRITING)
    const title = page.locator('#deck section.slide[data-index="0"] .sd-mark[data-mark="highlight"]')
    await expect(title.locator('svg path')).toHaveCount(0)
  })

  test('follows the deck, and the reader motion preference (N1, R15)', async ({ page }) => {
    await goTo(page, PRESENTING)
    await page.locator('#deck').focus()
    await page.keyboard.press('ArrowRight')

    const stroke = () =>
      page.evaluate(() => {
        const root = document.querySelector('#deck')?.shadowRoot
        const path = root?.querySelector('section.slide[data-active] .sd-mark[data-mark="circle"] svg path')
        return path ? getComputedStyle(path).stroke : ''
      })

    /* `color="accent"` is the deck's accent, drawn in the deck's palette. */
    await expect.poll(stroke).toBe('rgb(47, 111, 237)')
    await page.locator('.theme button[data-theme="dark"]').click()
    await expect.poll(stroke).toBe('rgb(122, 162, 247)')
  })

  test('draws immediately when the reader prefers reduced motion (N1, R15)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(DEMO)
    await goTo(page, TITLE)

    const first = strokes(page, 'highlight').first()
    await expect(first).toHaveCount(1)
    await expect(first).toHaveCSS('animation-name', 'none')

    /* With no such preference, the hand-drawing animation runs. */
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(DEMO)
    await goTo(page, TITLE)
    await expect(strokes(page, 'highlight').first()).toHaveCSS('animation-name', 'rough-notation-dash')
  })

  test("puts none of its styling in the host page (R8, R15)", async ({ page }) => {
    await goTo(page, TITLE)
    await expect(strokes(page, 'highlight')).not.toHaveCount(0)

    /* rough-notation would put its draw keyframes in `document.head`; the deck
       keeps them in its own shadow tree instead. */
    const leaked = await page.evaluate(() =>
      Array.from(document.head.querySelectorAll('style')).some((style) =>
        /rough-notation/.test(style.textContent ?? '')
      )
    )
    expect(leaked).toBe(false)

    const ownKeyframes = await page.evaluate(() => {
      const root = document.querySelector('#deck')?.shadowRoot
      return /@keyframes rough-notation-dash/.test(root?.querySelector('style')?.textContent ?? '')
    })
    expect(ownKeyframes).toBe(true)
  })
})
