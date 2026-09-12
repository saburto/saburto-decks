/**
 * Embedded mode: the deck living inside a host page.
 *
 * Covers R4 (a host page needs nothing but a script tag), R5 (one slide at a
 * time, in a box the host can size, scaled to that box), R8 (nothing crosses
 * the boundaries in either direction) and R10 (the host can drive the deck and
 * is told when it changes).
 */
import { expect, test } from '@playwright/test'
import { DEMO, deck, nextSlide, state } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.goto(DEMO)
  await expect.poll(() => state(page).then((s) => s.mode)).toBe('embedded')
})

test.describe('an embedded deck', () => {
  test('shows its three slides one at a time', async ({ page }) => {
    const first = await state(page)

    expect(first.count).toBe(3)
    expect(first.visible).toEqual([0])
    await expect(page.locator('.counter')).toHaveText('1 / 3')

    await nextSlide(page)
    expect((await state(page)).visible).toEqual([1])
    await expect(page.locator('.counter')).toHaveText('2 / 3')

    await nextSlide(page)
    expect((await state(page)).visible).toEqual([2])
    await expect(page.locator('.counter')).toHaveText('3 / 3')

    /* The last slide cannot go further. */
    await expect(page.locator('.bar button[aria-label="Next slide"]')).toBeDisabled()
  })

  test('never scrolls: a slide is scaled to fit the box instead', async ({ page }) => {
    const resize = (css: string) =>
      page.evaluate((content) => {
        document.getElementById('probe')?.remove()
        const style = document.createElement('style')
        style.id = 'probe'
        style.textContent = content
        document.head.append(style)
      }, css)

    const goToFirst = () =>
      page.evaluate(() => {
        const host = document.querySelector('#deck') as HTMLElement & { goTo(index: number): void }
        host.goTo(0)
      })

    for (const size of ['16rem', '24rem', '34rem', '44rem']) {
      await resize(`saburto-deck { width: ${size}; aspect-ratio: 4 / 3 }`)
      await goToFirst()

      for (let index = 0; index < 3; index++) {
        const measured = await state(page)
        expect(measured.index).toBe(index)
        expect(measured.clipped, `slide ${index} is clipped in a ${size} box`).toBeLessThanOrEqual(0)
        expect(measured.clippedHorizontally, `slide ${index} overflows sideways at ${size}`).toBeLessThanOrEqual(0)
        if (index < 2) await nextSlide(page)
      }
    }

    await resize('')
    /* Fitting must not mean unreadable in a box of a sane size. */
    expect((await state(page)).typePx).toBeGreaterThanOrEqual(16)
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
    await page.addStyleTag({ content: 'saburto-deck { width: 22rem; aspect-ratio: 4 / 3 }' })
    const narrow = await state(page)
    expect(narrow.typePx).toBeLessThan(wide.typePx)
  })

  test('the host page sizes the deck box', async ({ page }) => {
    const byDefault = (await state(page)).box
    expect(byDefault.width / byDefault.height).toBeCloseTo(16 / 9, 1)

    await page.addStyleTag({ content: 'saburto-deck { aspect-ratio: 4 / 3 }' })
    const square = (await state(page)).box
    expect(square.width / square.height).toBeCloseTo(4 / 3, 1)

    await page.addStyleTag({ content: 'saburto-deck { aspect-ratio: auto; height: 22rem }' })
    expect((await state(page)).box.height).toBeCloseTo(352, 0)
  })

  test('does not change how the host page looks (R8)', async ({ page }) => {
    /* The host page styles h1, p, section, button, a and code loudly and on
       purpose. Snapshot one of those, take the deck away, and compare. */
    const snapshot = () =>
      page.evaluate(() => {
        const el = document.querySelector('.wrap > section > p') as HTMLElement
        const style = getComputedStyle(el)
        const heading = getComputedStyle(document.querySelector('.wrap > h1') as HTMLElement)
        return {
          paragraph: [style.color, style.fontFamily, style.lineHeight, style.borderLeftWidth, style.paddingLeft],
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

    const heading = page.locator('#deck h1').first()
    await expect(heading).toHaveCSS('text-transform', 'none')
    await expect(heading).toHaveCSS('color', 'rgb(22, 24, 29)')
    await expect(page.locator('#deck section p').first()).toHaveCSS('border-left-width', '0px')
    await expect(page.locator('#deck section p').first()).toHaveCSS('font-family', /ui-sans-serif/)
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
          if (/\.stage|\.slide|:host|saburto-deck/.test(rule.cssText)) found.push(rule.cssText)
        }
      }
      return found
    })

    expect(deckRulesInDocument).toEqual([])
  })

  test('leaves the keyboard to the page until it is focused (N2)', async ({ page }) => {
    await page.locator('.wrap > h1').click()
    const before = await page.evaluate(() => window.scrollY)

    await page.keyboard.press('ArrowDown')
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before)
    expect((await state(page)).index).toBe(0)

    /* Focused, the same key drives the deck instead. */
    await page.locator('#deck h1').first().click()
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('.counter')).toHaveText('2 / 3')
    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('.counter')).toHaveText('1 / 3')
  })

  test('lets Tab walk in and out of it while embedded (N2)', async ({ page }) => {
    await page.locator('#deck h1').first().click()

    const stops: string[] = []
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      stops.push(await page.evaluate(() => {
        const host = document.querySelector('#deck') as HTMLElement
        const inside = host.shadowRoot?.activeElement
        if (inside) return `deck:${inside.textContent?.trim()}`
        return document.activeElement === host ? 'deck:itself' : `page:${(document.activeElement as HTMLElement | null)?.id || 'body'}`
      }))
    }

    /* Embedded, the deck must not trap focus: Tab has to be able to leave. */
    expect(stops.some((stop) => stop.startsWith('page:'))).toBe(true)
  })

  test('the host can drive it and is told what happened (R10)', async ({ page }) => {
    await page.evaluate(() => {
      const host = window as unknown as { modes: string[] }
      host.modes = []
      document.addEventListener('saburto-deck-mode-change', (event) => {
        host.modes.push((event as CustomEvent<{ mode: string }>).detail.mode)
      })
    })

    await page.locator('#present').click()

    await expect(deck(page)).toHaveAttribute('data-mode', 'present')
    await expect(page.locator('#status')).toHaveText('present · slide 1/3')
    await expect.poll(() => page.evaluate(() => (window as unknown as { modes: string[] }).modes)).toEqual(['present'])

    await page.locator('.bar button').last().click()

    await expect(deck(page)).toHaveAttribute('data-mode', 'embedded')
    await expect.poll(() => page.evaluate(() => (window as unknown as { modes: string[] }).modes)).toEqual([
      'present',
      'embedded'
    ])
  })

  test('the host decides the theme (R8)', async ({ page }) => {
    await expect(page.locator('#deck .deck')).toHaveCSS('background-color', 'rgb(255, 255, 255)')

    await page.locator('.theme button[data-theme="dark"]').click()

    await expect(deck(page)).toHaveAttribute('theme', 'dark')
    await expect(page.locator('#deck .deck')).toHaveCSS('background-color', 'rgb(17, 19, 24)')
    await expect(page.locator('#deck .deck')).toHaveCSS('color', 'rgb(232, 234, 237)')
  })
})
