/**
 * Including another file's slides (R18).
 *
 * A deck can be written as several files: an include on a slide of its own
 * brings the included file's slides into the deck, and the same include inside
 * a slide is that slide's content instead.
 */
import { expect, test, type Page } from '@playwright/test'
import { DEMO, deck, goTo, nextSlide, state } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto(DEMO)
  await expect(deck(page)).toHaveAttribute('data-mode', 'embedded')
  await expect(page.locator('#deck section.slide')).toHaveCount(23)
})

const active = (page: Page) => page.locator('#deck section.slide[data-active]')

test.describe('a file included on a slide of its own', () => {
  test("is the deck's own slides, in the place the include was written (R18)", async ({ page }) => {
    /* The slide before the include is the deck's nineteenth, so the included
       file's slides follow it as the twentieth and twenty-first. */
    await goTo(page, 18)
    await nextSlide(page)
    await expect(page.locator('#deck .counter')).toHaveText('20 / 23')

    const first = await state(page)
    expect(first.index).toBe(19)
    expect(first.visible).toEqual([19])
    await expect(active(page).locator('h2')).toHaveText('An imported file')

    await goTo(page, 20)
    await expect(page.locator('#deck .counter')).toHaveText('21 / 23')
    await expect(active(page).locator('h1')).toHaveText(
      "A picture from the imported file's own folder"
    )
    /* It fits at a readable size: the banded layout is the slide's content, so
       nothing beside it made the deck shrink the type to nothing. */
    expect((await state(page)).typePx).toBeGreaterThan(12)
  })

  test('brings its own picture, resolved against the included file (R18)', async ({ page }) => {
    await goTo(page, 20)

    const picture = active(page).locator('img')
    await expect(picture).toHaveCount(1)
    await expect(picture).toHaveAttribute('src', /layout-picture/)
    /* It resolved, not just appeared: the browser decoded a real image. */
    await expect
      .poll(() => picture.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0)
  })

  test("carries its steps into the deck's navigation (R12, R18)", async ({ page }) => {
    await goTo(page, 20)

    const arrived = await state(page)
    expect(arrived.stepCount).toBe(2)

    await nextSlide(page)
    const stepped = await state(page)
    expect(stepped.index).toBe(20)
    expect(stepped.step).toBe(1)

    /* Its last step is the slide's last: Next leaves the slide. */
    await nextSlide(page)
    expect((await state(page)).index).toBe(21)
  })
})

test.describe('a file included inside a slide', () => {
  test("is that slide's content, not slides of its own (R18)", async ({ page }) => {
    await goTo(page, 21)
    await expect(page.locator('#deck .counter')).toHaveText('22 / 23')

    /* The slide around the include is intact, with the include's own block in
       it, and the deck gained one slide rather than however many the file
       holds. */
    const shown = await state(page)
    expect(shown.count).toBe(23)
    expect(shown.visible).toEqual([21])
    await expect(active(page).locator('h2')).toHaveText('Included inside a slide')
    await expect(active(page).locator('h3')).toHaveText('An included fragment')
  })

  test("counts its steps with the slide's own (R12, R18)", async ({ page }) => {
    await goTo(page, 21)

    const arrived = await state(page)
    expect(arrived.stepCount).toBe(2)

    await nextSlide(page)
    const stepped = await state(page)
    /* The step moved; the slide did not. */
    expect(stepped.index).toBe(21)
    expect(stepped.step).toBe(1)
  })
})
