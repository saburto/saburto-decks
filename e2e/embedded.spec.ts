/**
 * Embedded mode: the deck living inside a host page.
 *
 * Covers R4 (a page embeds a deck the way it embeds any component), R5 (one
 * slide at a time, in a box the host can size, scaled to that box), R8 (nothing
 * crosses the boundaries in either direction) and R10 (the host can drive the
 * deck and is told when it changes).
 */
import { expect, test } from '@playwright/test'
import { DEMO, deck, goTo, hostCss, hostExitPresent, hostPresentButton, hostStatus, nextSlide, state } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto(DEMO)
  /* The deck is an island: wait for it to arrive before asserting anything. */
  await expect(deck(page)).toHaveAttribute('data-mode', 'embedded')
  await expect(page.locator('#deck section.slide')).toHaveCount(9)
})

test.describe('an embedded deck', () => {
  test('shows its nine slides one at a time', async ({ page }) => {
    expect((await state(page)).count).toBe(9)

    for (let index = 0; index < 9; index++) {
      /* Jumping straight to a slide, so a stepped slide cannot stand in the
         way of the next one. */
      await goTo(page, index)
      const shown = await state(page)
      expect(shown.index).toBe(index)
      expect(shown.visible).toEqual([index])
      await expect(page.locator('#deck .counter')).toHaveText(`${index + 1} / 9`)
    }

    /* The code slide has six steps; its last step is no longer the end of the
       deck, so Next moves on to the diagrams slide after it. */
    await goTo(page, 4)
    for (let i = 0; i < 5; i++) await nextSlide(page)
    await expect(page.locator('#deck .counter')).toHaveText('5 / 9')
    await nextSlide(page)
    await expect(page.locator('#deck .counter')).toHaveText('6 / 9')
  })

  test('highlights code, and follows the theme (R11)', async ({ page }) => {
    await goTo(page, 3)
    await expect(page.locator('#deck .counter')).toHaveText('4 / 9')

    const code = page.locator('#deck section.slide[data-active] pre.shiki')
    await expect(code).toHaveCount(1)
    await expect(page.locator('#deck section.slide[data-active] .sd-code-title')).toHaveText('Post.tsx')

    /* Highlighted means coloured: the tokens do not all share one colour. */
    const colors = await code.locator('span').evaluateAll((spans) =>
      Array.from(new Set(spans.map((span) => getComputedStyle(span).color)))
    )
    expect(colors.length).toBeGreaterThan(1)

    /* The current step's line is marked the way Shiki marks it, and the rest
       of the code recedes rather than the marked line being boxed. */
    await expect(page.locator('#deck section.slide[data-active] .line.highlighted')).toHaveCount(1)
    await expect(page.locator('#deck section.slide[data-active] .line:not(.highlighted)').first()).toHaveCSS(
      'opacity',
      '0.3'
    )

    /* Shiki emits both themes; the deck's own palette picks one. */
    await expect(code).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await page.locator('.theme button[data-theme="dark"]').click()
    await expect(code).toHaveCSS('background-color', 'rgb(18, 18, 18)')
  })

  test('steps through a code block before leaving the slide (R11, R12)', async ({ page }) => {
    await goTo(page, 3)
    await page.locator('#deck').focus()
    await expect(page.locator('#deck .counter')).toHaveText('4 / 9')

    /* Four steps; the slide arrives on the first, with line 1 highlighted. */
    let now = await state(page)
    expect(now.step).toBe(0)
    expect(now.stepCount).toBe(4)
    expect(now.activeLines).toBe(1)
    expect(now.hiddenCode).toBe(0)

    /* Advancing moves the step, not the slide. */
    await page.keyboard.press('ArrowRight')
    now = await state(page)
    expect(now.index).toBe(3)
    expect(now.step).toBe(1)
    expect(now.activeLines).toBe(1)

    /* `hide` takes the block off the slide entirely. */
    await page.keyboard.press('ArrowRight')
    now = await state(page)
    expect(now.step).toBe(2)
    expect(now.hiddenCode).toBe(1)
    expect(now.activeLines).toBe(0)

    /* `none` shows it again with nothing highlighted — every line recedes. */
    await page.keyboard.press('ArrowRight')
    now = await state(page)
    expect(now.step).toBe(3)
    expect(now.hiddenCode).toBe(0)
    expect(now.activeLines).toBe(0)
    await expect(page.locator('#deck section.slide[data-active] pre.shiki')).toBeVisible()
    await expect(page.locator('#deck section.slide[data-active] .line').first()).toHaveCSS('opacity', '0.3')

    /* The dots show where in the step sequence the reader is, the live region
       says it, and the host has been told (R10, N1). */
    await expect(page.locator('#deck .step-dot')).toHaveCount(4)
    await expect(page.locator('#deck .step-dot[data-on]')).toHaveCount(1)
    await expect(page.locator('#deck .live')).toHaveText('Slide 4 of 9, step 4 of 4')
    await expect(hostStatus(page)).toHaveText(/step 4\/4/)

    /* Previous walks the steps back, and from the first step returns to the
       slide before — landing on its last step, so the reader never moves two
       positions at once (R12). */
    await page.keyboard.press('ArrowLeft')
    expect((await state(page)).step).toBe(2)
    await page.keyboard.press('ArrowLeft')
    expect((await state(page)).step).toBe(1)
    await page.keyboard.press('ArrowLeft')
    expect((await state(page)).step).toBe(0)
    await page.keyboard.press('ArrowLeft')
    expect((await state(page)).index).toBe(2)

    /* Clicking the slide advances it too, as in Slidev. */
    await goTo(page, 3)
    await page.locator('#deck').focus()
    await page.locator('#deck section.slide[data-active] pre.shiki').click()
    now = await state(page)
    expect(now.index).toBe(3)
    expect(now.step).toBe(1)
  })

  test('walks the full Slidev sequence, {all|4|6|6-7|9|all} (R11, R12)', async ({ page }) => {
    await goTo(page, 4)
    await page.locator('#deck').focus()
    await expect(page.locator('#deck .counter')).toHaveText('5 / 9')

    /* Six steps: every line, then one line, then another, then a pair, then
       another, then every line again. */
    let now = await state(page)
    expect(now.stepCount).toBe(6)
    expect(now.step).toBe(0)
    expect(now.activeLines).toBe(10)

    const expected: Array<[number, number]> = [
      [1, 1], // line 4
      [2, 1], // line 6
      [3, 2], // lines 6-7
      [4, 1], // line 9
      [5, 10] // all
    ]
    for (const [step, lines] of expected) {
      await page.keyboard.press('ArrowRight')
      now = await state(page)
      expect(now.index, `still on the slide at step ${step}`).toBe(4)
      expect(now.step).toBe(step)
      expect(now.activeLines, `at step ${step}`).toBe(lines)
    }

    /* The diagrams slide is the last one, so the code slide's last step is
       followed by a move on to the next slide rather than the end. */
    await page.keyboard.press('ArrowRight')
    const moved = await state(page)
    expect(moved.index).toBe(5)
    expect(moved.step).toBe(0)
  })

  test('never scrolls: a slide is scaled to fit the box instead', async ({ page }) => {
    for (const width of ['16rem', '24rem', '34rem', '44rem']) {
      await hostCss(page, `#deck { width: ${width}; --sd-aspect: 4 / 3 }`)

      for (let index = 0; index < 9; index++) {
        await goTo(page, index)
        const measured = await state(page)
        expect(measured.index, `at slide ${index}`).toBe(index)
        expect(measured.clipped, `slide ${index} is clipped in a ${width} box`).toBeLessThanOrEqual(0)
        expect(measured.clippedHorizontally, `slide ${index} overflows sideways at ${width}`).toBeLessThanOrEqual(0)
      }
    }

    await hostCss(page, '')
    /* Fitting must not mean unreadable in a box of a sane size. */
    const back = await state(page)
    expect(back.typePx).toBeGreaterThanOrEqual(16)
  })

  test('sizes its type to the deck, not to the page or the viewport', async ({ page }) => {
    const wide = await state(page)
    expect(wide.box.width).toBeGreaterThan(400)

    await page.setViewportSize({ width: 1700, height: 900 })
    const resizedViewport = await state(page)
    /* The host page's column is fixed, so the deck's box did not change and
       neither did its type — the viewport never comes into it. */
    expect(resizedViewport.box.width).toBeCloseTo(wide.box.width, 0)
    expect(resizedViewport.typePx).toBeCloseTo(wide.typePx, 1)

    /* A narrower deck gets smaller type. */
    await hostCss(page, '#deck { width: 22rem; --sd-aspect: 4 / 3 }')
    const narrow = await state(page)
    expect(narrow.typePx).toBeLessThan(wide.typePx)
  })

  test('the host page sizes the deck box', async ({ page }) => {
    const byDefault = (await state(page)).box
    expect(byDefault.width / byDefault.height).toBeCloseTo(16 / 9, 1)

    await hostCss(page, '#deck { --sd-aspect: 1 / 1 }')
    const square = (await state(page)).box
    expect(square.width / square.height).toBeCloseTo(1, 1)

    await hostCss(page, '#deck { width: 30rem; --sd-aspect: auto; height: 12rem }')
    const fixed = (await state(page)).box
    expect(fixed.width).toBeCloseTo(480, 0)
    expect(fixed.height).toBeCloseTo(192, 0)
  })

  test('does not change how the host page looks (R8)', async ({ page }) => {
    /* The host page styles h1, p, section, button, a and code loudly and on
       purpose. Snapshot one of those, take the deck away, and compare. */
    const snapshot = () =>
      page.evaluate(() => {
        const paragraph = getComputedStyle(document.querySelector('.wrap > section > p') as HTMLElement)
        const heading = getComputedStyle(document.querySelector('.wrap > h1') as HTMLElement)
        return {
          paragraph: [paragraph.color, paragraph.fontFamily, paragraph.lineHeight, paragraph.borderLeftWidth, paragraph.paddingLeft],
          heading: [heading.color, heading.textTransform, heading.textDecorationLine]
        }
      })

    const withDeck = await snapshot()
    await page.evaluate(() => document.querySelector('#deck')?.remove())
    const withoutDeck = await snapshot()

    expect(withDeck).toEqual(withoutDeck)
    /* And those styles were really in force, deck or no deck. */
    expect(withDeck.heading[1]).toBe('uppercase')
    expect(withDeck.paragraph[3]).toBe('6px')
  })

  test('the host page styles do not reach into the deck (R8)', async ({ page }) => {
    /* The same elements, inside the deck, are untouched by those hostile rules. */
    await expect(page.locator('.wrap > h1')).toHaveCSS('text-transform', 'uppercase')
    await expect(page.locator('.wrap > h1')).toHaveCSS('color', 'rgb(220, 20, 60)')

    const heading = page.locator('#deck section.slide[data-active] h1').first()
    await expect(heading).toHaveCSS('text-transform', 'none')
    await expect(heading).toHaveCSS('color', 'rgb(22, 24, 29)')
    await expect(page.locator('#deck section.slide[data-active] p').first()).toHaveCSS('border-left-width', '0px')
    await expect(page.locator('#deck section.slide[data-active] p').first()).toHaveCSS('font-family', /ui-sans-serif/)
  })

  test('the deck styles do not reach into the host page (R8)', async ({ page }) => {
    /* A deck's stylesheet should not be anywhere in the document: it belongs to
       the shadow root. */
    const deckRulesInDocument = await page.evaluate(() => {
      const found: string[] = []
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList
        try {
          rules = sheet.cssRules
        } catch {
          continue
        }
        for (const rule of Array.from(rules)) {
          if (/\.stage|\.slide|:host/.test(rule.cssText)) found.push(rule.cssText.slice(0, 80))
        }
      }
      return found
    })

    expect(deckRulesInDocument).toEqual([])
  })

  test('leaves the keyboard to the page until it is focused (N1)', async ({ page }) => {
    await page.locator('.wrap > h1').click()
    const before = await page.evaluate(() => window.scrollY)

    await page.keyboard.press('ArrowDown')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before)
    expect((await state(page)).index).toBe(0)

    /* Focused, the same key drives the deck instead. */
    await page.locator('#deck section.slide[data-active] h1').first().click()
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('#deck .counter')).toHaveText('2 / 9')
    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('#deck .counter')).toHaveText('1 / 9')
  })

  test('lets Tab walk in and out of it while embedded (N1)', async ({ page }) => {
    await page.locator('#deck section.slide[data-active] h1').first().click()

    const stops: string[] = []
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      stops.push(await page.evaluate(() => {
        const host = document.querySelector('#deck') as HTMLElement
        const inside = host.shadowRoot?.activeElement
        if (inside) return `deck:${inside.textContent?.trim()}`
        return document.activeElement === host ? 'deck:itself' : `page:${(document.activeElement as HTMLElement | null)?.tagName.toLowerCase() ?? 'body'}`
      }))
    }

    /* Embedded, the deck must not trap focus: Tab has to be able to leave. */
    expect(stops.some((stop) => stop.startsWith('page:'))).toBe(true)
  })

  test('the host can drive it and is told what happened (R10)', async ({ page }) => {
    await expect(hostStatus(page)).toHaveText('embedded')

    await hostPresentButton(page).click()

    await expect(deck(page)).toHaveAttribute('data-mode', 'present')
    await expect(hostStatus(page)).toHaveText('present')
    await page.keyboard.press('ArrowRight')
    await expect(hostStatus(page)).toHaveText('present · slide 2/9')

    /* A presenting deck covers the page, so the host's own logic is what ends
       it — the button above is no longer reachable, which is the point. */
    await hostExitPresent(page)

    await expect(deck(page)).toHaveAttribute('data-mode', 'embedded')
    await expect(hostStatus(page)).toHaveText('embedded · slide 2/9')
  })

  test('the host decides the theme (R8)', async ({ page }) => {
    await expect(page.locator('#deck .deck')).toHaveCSS('background-color', 'rgb(255, 255, 255)')

    await page.locator('.theme button[data-theme="dark"]').click()

    await expect(deck(page)).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('#deck .deck')).toHaveCSS('background-color', 'rgb(17, 19, 24)')
    await expect(page.locator('#deck .deck')).toHaveCSS('color', 'rgb(232, 234, 237)')
  })
})
