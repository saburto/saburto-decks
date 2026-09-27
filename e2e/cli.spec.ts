/**
 * The command line (R23, acceptance criterion 13).
 *
 * The tests run the built command with **Node** — `npx` is the point — over a
 * deck in a temporary folder, and assert what the command promises: a deck
 * served whole, in its own window, with its own navigation, contents, theme
 * and present mode; the reader's place kept while the deck is edited; and the
 * page following the file, and everything the file includes, while the command
 * runs.
 *
 * The deck is deliberately outside the repository: the command is expected to
 * serve a file wherever it is, with nothing of the project's own around it.
 */
import { expect, test, type Page } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { appendFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { nextSlide, state } from './helpers'

/* The deck's folder is the server's root, so the address moves with the
   folder. 4175 is the next one after the two demo hosts. */
const PORT = 4175

/* Serial: one command serves one folder, and the folder is edited. */
test.describe.configure({ mode: 'serial' })

let command: ChildProcess
let url: string
let folder: string
let deck: string
let part: string

/** The address the command printed, which is the one it is served on. */
function printedUrl(child: ChildProcess): Promise<string> {
  return new Promise((found, failed) => {
    let output = ''
    const deadline = setTimeout(
      () => failed(new Error(`the command printed no address:\n${output}`)),
      60_000
    )
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString()
      const url = /http:\/\/[^\s]+:\d+\//.exec(output)?.[0]
      if (!url) return
      clearTimeout(deadline)
      found(url)
    })
    child.on('exit', (code) => {
      clearTimeout(deadline)
      failed(new Error(`the command exited (${code}):\n${output}`))
    })
  })
}

const contents = (page: Page) => page.locator('#deck .bar button', { hasText: 'Contents' })
const panel = (page: Page) => page.locator('#deck [role="dialog"][aria-label="Table of contents"]')
const entries = (page: Page) => page.locator('#deck .contents-panel [data-toc-slide]')
const counter = (page: Page) => page.locator('#deck .counter')

test.beforeAll(async () => {
  /* The command has to install nothing, but it does compile the deck. */
  test.setTimeout(120_000)
  folder = await mkdtemp(join(tmpdir(), 'saburto-decks-served-'))
  deck = join(folder, 'served.mdx')
  part = join(folder, 'parts', 'more.mdx')
  await mkdir(join(folder, 'parts'))
  await writeFile(part, '# Included\n\nFrom its own folder.\n')
  await writeFile(
    deck,
    `---
title: A served deck
---

# Served

One.

## Under it

Read me.

---

## Second

Two.

---

<Slides src="./parts/more.mdx" />
`
  )

  command = spawn('node', [resolve('dist', 'cli.js'), deck, '--port', String(PORT)], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe']
  })
  url = await printedUrl(command)
})

test.afterAll(() => {
  command?.kill('SIGTERM')
})

test.describe('a deck served from a file', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(url)
    await expect(page.locator('#deck section.slide')).toHaveCount(3)
  })

  test('serves the deck whole, one slide at a time', async ({ page }) => {
    const shown = await state(page)
    expect(shown.count).toBe(3)
    expect(shown.mode).toBe('embedded')
    expect(shown.visible).toEqual([0])
    /* The deck is the page: the whole window, not a box in one. */
    expect(shown.box).toEqual({ width: 1280, height: 800 })
    expect(shown.clipped).toBeLessThanOrEqual(0)
    /* And it is the deck's own title, from its frontmatter. */
    await expect(page).toHaveTitle('A served deck')
  })

  test('navigates with the keyboard and the deck’s own controls', async ({ page }) => {
    await page.keyboard.press('ArrowRight')
    await expect(counter(page)).toHaveText('2 / 3')
    await nextSlide(page)
    await expect(counter(page)).toHaveText('3 / 3')
    await page.keyboard.press('ArrowLeft')
    await expect(counter(page)).toHaveText('2 / 3')
  })

  test('presents from the deck, and comes back to where it was', async ({ page }) => {
    await page.keyboard.press('ArrowRight')
    await page.locator('#deck .bar button').last().click()
    await expect(page.locator('#deck')).toHaveAttribute('data-mode', 'present')

    const presenting = await state(page)
    expect(presenting.surface.position).toBe('fixed')
    expect(presenting.surface.width).toBe(1280)
    expect(presenting.surface.height).toBe(800)

    await page.keyboard.press('Escape')
    await expect(page.locator('#deck')).toHaveAttribute('data-mode', 'embedded')
    await expect(counter(page)).toHaveText('2 / 3')
  })

  test('opens the deck’s contents, and goes where the reader chooses', async ({ page }) => {
    await contents(page).click()
    await expect(panel(page)).toBeVisible()
    await expect(entries(page)).toHaveCount(3)
    /* The include's slides are the deck's own (R18). */
    await expect(entries(page).nth(2)).toContainText('Included')

    await entries(page).nth(1).click()
    await expect(panel(page)).toBeHidden()
    await expect(counter(page)).toHaveText('2 / 3')
  })

  test('switches the theme, and remembers the reader’s choice', async ({ page }) => {
    await expect(page.locator('#deck')).toHaveAttribute('data-theme', 'light')

    await page.locator('.themes button[data-theme="dark"]').click()
    await expect(page.locator('#deck')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('.themes button[data-theme="dark"]')).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    await page.reload()
    await expect(page.locator('#deck')).toHaveAttribute('data-theme', 'dark')

    /* Leave the page as the next test expects to find it. */
    await page.locator('.themes button[data-theme="light"]').click()
    await expect(page.locator('#deck')).toHaveAttribute('data-theme', 'light')
  })

  test('keeps the reader’s slide across the reload a save causes', async ({ page }) => {
    await page.keyboard.press('ArrowRight')
    await expect(counter(page)).toHaveText('2 / 3')
    expect(new URL(page.url()).hash).toBe('#slide=2')

    await page.reload()
    await expect(counter(page)).toHaveText('2 / 3')
    expect((await state(page)).index).toBe(1)
  })

  test('follows the deck file, and the files it includes, while it runs', async ({ page }) => {
    test.slow()
    await page.keyboard.press('ArrowRight')
    await expect(counter(page)).toHaveText('2 / 3')

    /* An included file is watched like the deck itself (R18, R23). */
    await appendFile(part, '\n---\n\n# Added\n\nWhile the reader was here.\n')
    await expect(page.locator('#deck section.slide')).toHaveCount(4)
    await expect(counter(page)).toHaveText('2 / 4')

    /* And so is the deck file. The reader is still where they were. */
    await appendFile(deck, '\n---\n\n## Also added\n\nFrom the deck file.\n')
    await expect(page.locator('#deck section.slide')).toHaveCount(5)
    await expect(counter(page)).toHaveText('2 / 5')
    expect((await state(page)).index).toBe(1)
  })
})

test('serves a deck that arrives on standard input', async ({ page }) => {
  /* The piped deck gets its own command, and its own address. */
  const piped = spawn('node', [resolve('dist', 'cli.js'), '-', '--port', '4176'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe']
  })

  try {
    piped.stdin?.end(`# Piped\n\nOne.\n\n---\n\n## Second\n\nTwo.\n`)
    await page.goto(await printedUrl(piped))

    await expect(page.locator('#deck section.slide')).toHaveCount(2)
    await expect(counter(page)).toHaveText('1 / 2')
    await page.keyboard.press('ArrowRight')
    await expect(counter(page)).toHaveText('2 / 2')
  } finally {
    piped.kill('SIGTERM')
  }
})
