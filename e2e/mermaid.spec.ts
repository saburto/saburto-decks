/**
 * Diagrams: a Mermaid fence is drawn rather than printed (R13), and a sequence
 * diagram or a node/edge graph — a flowchart, a state diagram, a class diagram
 * — is revealed one element at a time (R14).
 *
 * The demo deck keeps each diagram on its own slide, in this order.
 */
import { expect, test, type Page } from '@playwright/test'
import { DEMO, deck, goTo, hostCss, state } from './helpers'

/** The slide with the sequence diagram. */
const SEQUENCE = 6
/** The slide with the flowchart. */
const FLOWCHART = 7
/** The slide with the state diagram. */
const STATE = 8
/** The slide with the class diagram. */
const CLASS = 9

interface DrawnDiagram {
  /** The step count the deck is using for this diagram. */
  steps: number
  /** How many elements carry a step, and how many of those are revealed. */
  total: number
  revealed: number
}

async function drawn(page: Page): Promise<DrawnDiagram[]> {
  return page.evaluate(() => {
    const host = document.querySelector('#deck') as HTMLElement
    const active = host.shadowRoot?.querySelector('section.slide[data-active]')
    return Array.from(active?.querySelectorAll('.sd-mermaid') ?? []).map((diagram) => ({
      steps: Number((diagram as HTMLElement).dataset['steps'] ?? 1),
      total: diagram.querySelectorAll('[data-sd-step]').length,
      revealed: diagram.querySelectorAll('[data-sd-step].sd-shown').length
    }))
  })
}

/** The sequence diagram's participants that are on screen, in declaration order. */
async function participants(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const host = document.querySelector('#deck') as HTMLElement
    const sequence = host.shadowRoot?.querySelector('section.slide[data-active] .sd-mermaid')
    const names = Array.from(
      sequence?.querySelectorAll('[data-et="participant"].sd-shown') ?? []
    ).map((box) => (box.textContent ?? '').trim())
    return names.sort()
  })
}

/** The sequence diagram's messages that are on screen. */
async function messages(page: Page): Promise<number> {
  return page.evaluate(() => {
    const host = document.querySelector('#deck') as HTMLElement
    const sequence = host.shadowRoot?.querySelector('section.slide[data-active] .sd-mermaid')
    return sequence?.querySelectorAll('[data-et="message"].sd-shown').length ?? 0
  })
}

/** How many of a graph diagram's nodes, edges and edge labels are on screen. */
async function graph(page: Page): Promise<{ nodes: number; edges: number; labels: number }> {
  return page.evaluate(() => {
    const host = document.querySelector('#deck') as HTMLElement
    const root = host.shadowRoot?.querySelector('section.slide[data-active] .sd-mermaid')
    return {
      nodes: root?.querySelectorAll('g.nodes g.node.sd-shown').length ?? 0,
      edges: root?.querySelectorAll('g.edgePaths path.sd-shown').length ?? 0,
      labels: root?.querySelectorAll('g.edgeLabels g.edgeLabel.sd-shown').length ?? 0
    }
  })
}

/** The fill of a participant's box, as the browser computes it. */
async function actorFill(page: Page): Promise<[number, number, number]> {
  return page.evaluate(() => {
    const host = document.querySelector('#deck') as HTMLElement
    const box = host.shadowRoot?.querySelector('section.slide[data-active] rect.actor-top')
    const color = box ? getComputedStyle(box).fill : 'rgb(0, 0, 0)'
    const [r, g, b] = color.match(/\d+/g)?.map(Number) ?? [0, 0, 0]
    return [r ?? 0, g ?? 0, b ?? 0]
  })
}

/** Moves to a diagram slide and waits until Mermaid has drawn it. */
async function openDiagram(page: Page, slide: number, steps: number): Promise<void> {
  await goTo(page, slide)
  await expect(page.locator('#deck section.slide[data-active] .sd-mermaid svg')).toHaveCount(1)
  await expect.poll(async () => (await drawn(page))[0]?.steps).toBe(steps)
  await page.locator('#deck').focus()
}

test.beforeEach(async ({ page }) => {
  await page.goto(DEMO)
  await expect(deck(page)).toHaveAttribute('data-mode', 'embedded')
  await openDiagram(page, SEQUENCE, 5)
})

test.describe('diagrams', () => {
  test('draws a mermaid fence as a diagram (R13)', async ({ page }) => {
    await expect(page.locator('#deck section.slide[data-active] .sd-mermaid svg')).toBeVisible()

    /* Two participants and three messages: five steps, and every marked
       element starts hidden until the reader reaches it. */
    const [sequence] = await drawn(page)
    expect(sequence?.steps).toBe(5)
    expect(sequence?.total).toBeGreaterThan(0)
    expect(sequence?.revealed).toBeLessThan(sequence?.total ?? 0)

    /* The source is never left on the slide as text. */
    expect(
      await page.locator('#deck section.slide[data-active] .sd-mermaid-source:visible').count()
    ).toBe(0)
  })

  test('reveals the sequence a participant and a message at a time (R14)', async ({ page }) => {
    expect(await participants(page)).toEqual(['Alice'])
    expect(await messages(page)).toBe(0)

    /* The participants are declared in order, so John arrives second. */
    await page.keyboard.press('ArrowRight')
    expect(await participants(page)).toEqual(['Alice', 'John'])
    expect(await messages(page)).toBe(0)

    /* Then one message per step, in the order they are written. */
    for (const expected of [1, 2, 3]) {
      await page.keyboard.press('ArrowRight')
      expect(await messages(page)).toBe(expected)
    }

    /* Five steps in all: the dots and the live region agree. */
    await expect(page.locator('#deck .step-dot')).toHaveCount(5)
    await expect(page.locator('#deck .live')).toHaveText('Slide 7 of 23, step 5 of 5')

    /* The sequence slide is not the deck's last, so Next moves on to the
       flowchart — which has steps of its own (R14). */
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('#deck .counter')).toHaveText('8 / 23')

    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('#deck .counter')).toHaveText('7 / 23')
    expect(await messages(page)).toBe(3)

    /* Previous walks back through the messages, then the participants. */
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft')
    expect(await messages(page)).toBe(0)
    expect(await participants(page)).toEqual(['Alice', 'John'])
    await page.keyboard.press('ArrowLeft')
    expect(await participants(page)).toEqual(['Alice'])
  })

  test('reveals a flowchart a node and an edge at a time (R14)', async ({ page }) => {
    await openDiagram(page, FLOWCHART, 5)

    /* Three nodes and two edges: the nodes first, in declaration order... */
    expect(await graph(page)).toEqual({ nodes: 1, edges: 0, labels: 0 })
    await page.keyboard.press('ArrowRight')
    expect((await graph(page)).nodes).toBe(2)
    await page.keyboard.press('ArrowRight')
    expect(await graph(page)).toEqual({ nodes: 3, edges: 0, labels: 0 })

    /* ...then the edges, each with its label. */
    await page.keyboard.press('ArrowRight')
    expect(await graph(page)).toEqual({ nodes: 3, edges: 1, labels: 0 })
    await page.keyboard.press('ArrowRight')
    expect(await graph(page)).toEqual({ nodes: 3, edges: 2, labels: 1 })
    await expect(page.locator('#deck .live')).toHaveText('Slide 8 of 23, step 5 of 5')

    /* Next moves on to the state diagram; Previous comes back to the end. */
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('#deck .counter')).toHaveText('9 / 23')
    await page.keyboard.press('ArrowLeft')
    expect(await graph(page)).toEqual({ nodes: 3, edges: 2, labels: 1 })

    /* Back through the edges, then the nodes. */
    await page.keyboard.press('ArrowLeft')
    expect((await graph(page)).edges).toBe(1)
    await page.keyboard.press('ArrowLeft')
    expect((await graph(page)).edges).toBe(0)
    await page.keyboard.press('ArrowLeft')
    expect((await graph(page)).nodes).toBe(2)
  })

  test('reveals a state diagram a state and a transition at a time (R14)', async ({ page }) => {
    await openDiagram(page, STATE, 6)

    /* Three states — the start pseudo-state, Idle and Running — then the three
       transitions. */
    expect((await graph(page)).nodes).toBe(1)
    for (const expected of [2, 3]) {
      await page.keyboard.press('ArrowRight')
      expect((await graph(page)).nodes).toBe(expected)
    }
    expect((await graph(page)).edges).toBe(0)
    for (const expected of [1, 2, 3]) {
      await page.keyboard.press('ArrowRight')
      expect((await graph(page)).edges).toBe(expected)
    }

    await expect(page.locator('#deck .live')).toHaveText('Slide 9 of 23, step 6 of 6')
    await page.keyboard.press('ArrowRight')
    /* The class diagram follows, and the motion slide is after that. */
    await expect(page.locator('#deck .counter')).toHaveText('10 / 23')
  })

  test('reveals a class diagram a class and a relation at a time (R14)', async ({ page }) => {
    await openDiagram(page, CLASS, 5)

    /* Three classes, then the two relations. */
    for (const expected of [1, 2, 3]) {
      expect((await graph(page)).nodes).toBe(expected)
      if (expected < 3) await page.keyboard.press('ArrowRight')
    }
    expect((await graph(page)).edges).toBe(0)
    await page.keyboard.press('ArrowRight')
    expect((await graph(page)).edges).toBe(1)
    await page.keyboard.press('ArrowRight')
    expect((await graph(page)).edges).toBe(2)

    /* Five steps, and the class diagram is no longer the deck's last slide:
       the motion slide follows it, so Next has somewhere to go. */
    await expect(page.locator('#deck .live')).toHaveText('Slide 10 of 23, step 5 of 5')
    await expect(page.locator('#deck .bar button[aria-label="Next slide"]')).toBeEnabled()

    /* Previous reverses it. */
    await page.keyboard.press('ArrowLeft')
    expect((await graph(page)).edges).toBe(1)
    await page.keyboard.press('ArrowLeft')
    expect((await graph(page)).edges).toBe(0)
    await page.keyboard.press('ArrowLeft')
    expect((await graph(page)).nodes).toBe(2)
  })

  test('draws in the deck theme, and redraws when it changes (R13)', async ({ page }) => {
    const light = await actorFill(page)
    expect(light[0] + light[1] + light[2]).toBeGreaterThan(300)

    await page.locator('.theme button[data-theme="dark"]').click()
    await expect(deck(page)).toHaveAttribute('data-theme', 'dark')

    /* Mermaid bakes its colours into the drawing, so a theme change is a
       redraw — darker actor boxes are the proof it happened. */
    await expect
      .poll(async () => {
        const dark = await actorFill(page)
        return dark[0] + dark[1] + dark[2]
      })
      .toBeLessThan(300)
  })

  test('is sized to the deck and never scrolled (R5, R13)', async ({ page }) => {
    for (const width of ['22rem', '34rem', '48rem']) {
      await hostCss(page, `#deck { width: ${width}; --sd-aspect: 4 / 3 }`)

      for (const slide of [SEQUENCE, FLOWCHART, STATE, CLASS]) {
        await goTo(page, slide)
        await expect(page.locator('#deck section.slide[data-active] .sd-mermaid svg')).toHaveCount(
          1
        )
        const measured = await state(page)
        expect(measured.index).toBe(slide)
        expect(measured.clipped, `slide ${slide} clipped in a ${width} box`).toBeLessThanOrEqual(0)
        expect(
          measured.clippedHorizontally,
          `slide ${slide} overflows at ${width}`
        ).toBeLessThanOrEqual(0)
      }
    }
  })
})
