/**
 * The table of contents (R17).
 *
 * Every deck carries one, built from the slides' own headings and reachable
 * from any slide. It is a control, not a slide: it opens over the stage, close
 * enough to the deck to be dismissible and never able to change how a slide
 * fits.
 */
import { expect, test, type Page } from '@playwright/test'
import { DEMO, deck, fullScreen, goTo, state } from './helpers'

const contentsButton = (page: Page) => page.locator('#deck .bar button', { hasText: 'Contents' })
const panel = (page: Page) => page.locator('#deck [role="dialog"][aria-label="Table of contents"]')
/* Scoped to the panel: the slides' own `<Contents />` carries the same classes,
   and lives in the same shadow root. */
const entries = (page: Page) => page.locator('#deck .contents-panel [data-toc-entry]')
const titles = (page: Page) => page.locator('#deck .contents-panel .contents-title')

/** The example deck's slides, by their own first headings. */
const HEADINGS = [
  'Saburto Decks',
  'Contents',
  'Writing a deck',
  'Presenting it',
  'Code',
  'Steps',
  'Diagrams',
  'Flowcharts',
  'State diagrams',
  'Class diagrams',
  'Motion',
  'Two columns',
  'A picture beside the text',
  'Two subtitles, four blocks',
  'A grid of four',
  'Six blocks',
  'A title and bullets',
  'A diagram beside the text',
  'Three blocks in a column'
]

test.beforeEach(async ({ page }) => {
  await page.goto(DEMO)
  await expect(deck(page)).toHaveAttribute('data-mode', 'embedded')
  await expect(page.locator('#deck section.slide')).toHaveCount(19)
})

test.describe('the table of contents', () => {
  test('is reachable from any slide and lists the slides by their headings (R17)', async ({ page }) => {
    for (const index of [0, 4, 9]) {
      await goTo(page, index)
      await contentsButton(page).click()

      await expect(panel(page)).toBeVisible()
      await expect(entries(page)).toHaveCount(19)
      const listed = await titles(page).allTextContents()
      expect(listed).toEqual(HEADINGS)

      /* The reader's own slide is marked, wherever in the deck they are. */
      await expect(page.locator('#deck .contents-panel [data-toc-entry][aria-current="true"]')).toHaveCount(1)
      await expect(
        page.locator('#deck .contents-panel [data-toc-entry][aria-current="true"] .contents-title')
      ).toHaveText(listed[index] ?? '')

      /* The control toggles, and Escape dismisses. */
      await contentsButton(page).click()
      await expect(panel(page)).toBeHidden()
      await contentsButton(page).click()
      await page.keyboard.press('Escape')
      await expect(panel(page)).toBeHidden()
    }
  })

  test('goes to the chosen slide and dismisses itself (R17)', async ({ page }) => {
    await goTo(page, 0)
    await contentsButton(page).click()

    await page.getByRole('button', { name: 'Diagrams', exact: true }).click()

    await expect(panel(page)).toBeHidden()
    const moved = await state(page)
    expect(moved.index).toBe(6)
    await expect(page.locator('#deck .counter')).toHaveText('7 / 19')

    /* Choosing is navigation, so the live region and the host are told (R10, N1). */
    await expect(page.locator('#deck .live')).toHaveText(/^Slide 7 of 19/)
  })

  test('is driven by the keyboard (R17, N1)', async ({ page }) => {
    await goTo(page, 3)
    await page.locator('#deck').focus()

    /* `O` opens it, and focus lands on the reader's own slide. */
    await page.keyboard.press('o')
    await expect(panel(page)).toBeVisible()
    await expect(page.locator('#deck [data-toc-entry]:focus .contents-title')).toHaveText('Presenting it')

    /* The arrow keys move through the entries, and the deck does not move
       under them while it is open. */
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('#deck [data-toc-entry]:focus .contents-title')).toHaveText('Code')
    expect((await state(page)).index).toBe(3)

    /* Enter chooses, and focus returns to the control that opened it. */
    await page.keyboard.press('Enter')
    await expect(panel(page)).toBeHidden()
    expect((await state(page)).index).toBe(4)
    await expect(page.locator('#deck .bar button:focus')).toHaveText('Contents')
  })

  test('dismisses on a click outside the panel without advancing the slide (R17)', async ({ page }) => {
    await goTo(page, 6)
    await contentsButton(page).click()
    await expect(panel(page)).toBeVisible()

    /* The backdrop, just inside the top-left of the stage. */
    await panel(page).click({ position: { x: 4, y: 4 } })

    await expect(panel(page)).toBeHidden()
    expect((await state(page)).index).toBe(6)
  })

  test('is reachable while presenting (R6, R17)', async ({ page }) => {
    await goTo(page, 2)
    await fullScreen(page)
    await expect(deck(page)).toHaveAttribute('data-mode', 'present')

    await page.keyboard.press('o')
    await expect(panel(page)).toBeVisible()
    await expect(panel(page)).toHaveCSS('position', 'absolute')

    await page.getByRole('button', { name: 'Class diagrams', exact: true }).click()

    await expect(panel(page)).toBeHidden()
    expect((await state(page)).index).toBe(9)
    /* Choosing a slide in the contents is not leaving the presentation. */
    await expect(deck(page)).toHaveAttribute('data-mode', 'present')
  })

  test('is also a slide the author writes (R17)', async ({ page }) => {
    await goTo(page, 1)

    /* The same list, as the slide's own content: every entry, the reader's own
       slide marked. */
    const list = page.locator('#deck section.slide[data-active] .sd-contents')
    await expect(list).toBeVisible()
    await expect(list.locator('[data-toc-entry]')).toHaveCount(19)
    expect(await list.locator('.contents-title').allTextContents()).toEqual(HEADINGS)
    await expect(list.locator('[data-toc-entry][aria-current="true"]')).toHaveCount(1)

    /* Choosing an entry goes to that slide; the click belongs to the entry and
       does not also advance the deck. */
    await list.getByRole('button', { name: 'Motion', exact: true }).click()
    expect((await state(page)).index).toBe(10)
    await expect(page.locator('#deck .counter')).toHaveText('11 / 19')

    /* On a slide it is slide content: measured with the slide, and no scroll. */
    await goTo(page, 1)
    const measured = await state(page)
    expect(measured.clipped).toBeLessThanOrEqual(0)
    expect(measured.clippedHorizontally).toBeLessThanOrEqual(0)
  })

  test('never changes how the slide fits (R17)', async ({ page }) => {
    await goTo(page, 5)
    const before = await state(page)

    await contentsButton(page).click()
    await expect(panel(page)).toBeVisible()

    const after = await state(page)
    expect(after.typePx).toBeCloseTo(before.typePx, 5)
    expect(after.clipped).toBeLessThanOrEqual(0)
    expect(after.clippedHorizontally).toBeLessThanOrEqual(0)
  })
})
