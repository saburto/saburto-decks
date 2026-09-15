/**
 * A layout that uses the deck's box (R21).
 *
 * `<Stage>` is the room the deck has for a slide, measured and handed over. The
 * deck's own layout is what this is really about, so it is asserted where it
 * can be seen: the box the slide was given is the stage's own room — the whole
 * width, past the measure a slide keeps its text to, and the whole height — it
 * follows the deck's box when the host resizes it, it is measured again when
 * the deck takes the screen, and a page that uses it is still fitted rather than
 * scrolled (R5).
 */
import { expect, test, type Page } from '@playwright/test'
import { DEMO, fullScreen, goTo, state } from './helpers'

/** The deck's own last slide: the page that fills the box. */
const PAGE = 23

/** The stage's room, the box the slide was given, and the slide's own column. */
const geometry = (page: Page) =>
  page.evaluate(() => {
    const root = (document.querySelector('#deck') as HTMLElement).shadowRoot!
    const stage = root.querySelector('.stage') as HTMLElement
    const slide = root.querySelector('section.slide[data-active]') as HTMLElement
    const box = slide.querySelector(':scope > main') as HTMLElement
    const style = getComputedStyle(stage)
    const px = (value: string) => Number.parseFloat(value)
    const stageRect = stage.getBoundingClientRect()
    const boxRect = box.getBoundingClientRect()

    return {
      room: {
        left: stageRect.left + px(style.paddingLeft),
        top: stageRect.top + px(style.paddingTop),
        width: stage.clientWidth - px(style.paddingLeft) - px(style.paddingRight),
        height: stage.clientHeight - px(style.paddingTop) - px(style.paddingBottom)
      },
      box: { left: boxRect.left, top: boxRect.top, width: boxRect.width, height: boxRect.height },
      slide: { left: slide.getBoundingClientRect().left, width: slide.clientWidth }
    }
  })

test.beforeEach(async ({ page }) => {
  await page.goto(DEMO)
  await goTo(page, PAGE)
  await expect(page.locator('#deck .counter')).toHaveText('24 / 24')
})

test.describe('a layout that uses the deck’s box', () => {
  test('is the whole room the deck has for a slide (R21)', async ({ page }) => {
    const { room, box } = await geometry(page)

    expect(box.left).toBeCloseTo(room.left, 0)
    expect(box.top).toBeCloseTo(room.top, 0)
    expect(Math.abs(box.width - room.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(box.height - room.height)).toBeLessThanOrEqual(1)
  })

  test('is the stage’s room, not the measure a slide keeps its text to (R21)', async ({ page }) => {
    const { room, box, slide } = await geometry(page)

    /* The box is wider than the slide it is laid out in, and centred on it:
       that is the whole point of the deck measuring it rather than leaving the
       author to describe it in the deck's own units. */
    expect(box.width).toBeGreaterThan(slide.width)
    expect(box.left + box.width / 2).toBeCloseTo(slide.left + slide.width / 2, 0)
    expect(box.width).toBeCloseTo(room.width, 0)
  })

  test('follows the deck’s box when the host resizes it (R21)', async ({ page }) => {
    await page.addStyleTag({ content: '#deck { width: 640px }' })

    await expect
      .poll(async () => {
        const { room, box } = await geometry(page)
        return Math.abs(box.width - room.width) + Math.abs(box.height - room.height)
      })
      .toBeLessThanOrEqual(2)
  })

  test('is fitted rather than scrolled, and keeps the page’s foot at its foot (R5, R21)', async ({
    page
  }) => {
    const { box } = await geometry(page)
    const foot = await page
      .locator('#deck section.slide[data-active] > main > p:last-child')
      .boundingBox()

    /* Nothing of the slide hangs out of the box the deck gave it... */
    expect((await state(page)).clipped).toBeLessThanOrEqual(0)
    /* ...and the content after the growing band really is at the box's foot:
       the box is a height to lay a page out in, not a minimum. */
    expect(foot!.y + foot!.height).toBeCloseTo(box.top + box.height, 0)
  })

  test('is measured again when the deck takes the screen (R6, R21)', async ({ page }) => {
    await fullScreen(page)
    await expect(page.locator('#deck')).toHaveAttribute('data-mode', 'present')

    await expect
      .poll(async () => {
        const { room, box } = await geometry(page)
        return Math.abs(box.width - room.width) + Math.abs(box.height - room.height)
      })
      .toBeLessThanOrEqual(2)
  })
})
