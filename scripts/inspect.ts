#!/usr/bin/env bun
/**
 * A development tool: put a deck on screen, ask it where it is, and take a
 * picture.
 *
 * The deck renders inside a shadow root, so "what does slide 5 actually look
 * like?" is not a question the test suite answers — it asserts, it does not
 * show. This prints the same state `e2e/helpers.ts` reads (so the number you
 * see here is the number a test would see), and writes a PNG when asked.
 * Without it, every layout change starts by rewriting a throwaway script.
 *
 *   bun run inspect                                  # slide 0, state only
 *   bun run inspect --slide 5 --step 2               # a code block, mid-stepping
 *   bun run inspect --slide 8 --shot /tmp/deck.png
 *   bun run inspect --present --dark
 *   bun run inspect --url http://127.0.0.1:4174/     # the React host
 *   bun run inspect --width 16rem --aspect '4 / 3'   # a deliberately cramped box
 *
 * The host has to be built (`bun run build`). If nothing answers at `--url`
 * the script starts the matching preview itself, and stops it again on the way
 * out.
 */
import { chromium } from '@playwright/test'
import { state } from '../e2e/helpers.ts'

const argv = process.argv.slice(2).filter((argument) => argument !== '--')

const flag = (name: string): string | undefined => {
  const at = argv.indexOf(name)
  return at === -1 ? undefined : argv[at + 1]
}
const has = (name: string): boolean => argv.includes(name)

const url = flag('--url') ?? 'http://127.0.0.1:4173/'
const width = flag('--width')
const aspect = flag('--aspect')
const shot = flag('--shot')
const present = has('--present')
const dark = has('--dark')
const asJson = has('--json')

/** Prints and stops, for a flag that cannot be honoured. */
function fail(message: string): never {
  console.error(`inspect: ${message}`)
  process.exit(1)
}

/** Parses a numeric flag, refusing to guess at a typo. */
function numericFlag(name: string): number | undefined {
  const raw = flag(name)
  if (raw === undefined) return undefined
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) fail(`${name} expects a whole number, got "${raw}"`)
  return value
}

const slide = numericFlag('--slide')
const step = numericFlag('--step')

const reachable = async (target: string): Promise<boolean> => {
  try {
    const response = await fetch(target, { signal: AbortSignal.timeout(1500) })
    return response.status < 500
  } catch {
    return false
  }
}

const waitForServer = async (target: string, timeoutMs: number): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await reachable(target)) return true
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return false
}

/* The two hosts are two ports; the port tells us which preview starts. */
const preview = url.includes(':4174') ? 'preview:react' : 'preview'

let server: ReturnType<typeof Bun.spawn> | undefined
let serverError = ''
/* The preview runs as its own process group (`detached`), so that stopping it
   stops the server it spawns too — killing only the `bun run` wrapper leaves
   `astro`/`vite preview` orphaned and holding the port. */
const stopServer = () => {
  if (!server) return
  try {
    process.kill(-server.pid, 'SIGTERM')
  } catch {
    server.kill()
  }
}

if (!(await reachable(url))) {
  console.log(`${url} is not answering — starting \`bun run ${preview}\``)
  /* Stderr is kept rather than inherited: the preview dies of SIGTERM when
     this script is done with it, and `bun run` reports that as an error we
     do not want to show — but a preview that never starts is worth seeing. */
  server = Bun.spawn(['bun', 'run', preview], { stdout: 'ignore', stderr: 'pipe', detached: true })
  const spawned = server
  void (async () => {
    const decoder = new TextDecoder()
    const pipe = spawned.stderr
    if (!pipe || typeof pipe === 'number') return
    const reader = pipe.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      serverError += decoder.decode(value)
    }
  })()
  process.on('SIGINT', stopServer)
  if (!(await waitForServer(url, 30_000))) {
    stopServer()
    if (serverError.trim()) console.error(serverError.trim())
    fail(`the preview never came up at ${url} — has the host been built? (bun run build)`)
  }
}

const browser = await chromium.launch({ channel: 'chromium' })

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto(url)
  await page.waitForSelector('#deck')
  /* The deck is client-only (R8), so wait for the slides to exist at all. */
  await page.waitForFunction(
    () =>
      (document.querySelector('#deck')?.shadowRoot?.querySelectorAll('section.slide').length ?? 0) >
      0
  )

  if (width || aspect) {
    const rules = [
      width ? `#deck { width: ${width}; }` : '',
      aspect ? `#deck { --sd-aspect: ${aspect}; }` : ''
    ].join('\n')
    await page.addStyleTag({ content: rules })
  }

  if (dark) {
    const button = page.locator('.theme button[data-theme="dark"]')
    if (await button.count()) await button.click()
    else await page.evaluate(() => (document.documentElement.dataset['theme'] = 'dark'))
  }

  if (present) {
    await page.locator('#present').click()
    await page.waitForSelector('#deck[data-mode="present"]')
  }

  if (slide !== undefined || step !== undefined) {
    await page.evaluate(
      ({ at, within }) => {
        const deck = (
          window as unknown as {
            deck?: { goTo(index: number, step?: number): void; goToStep(step: number): void }
          }
        ).deck
        if (at === null) deck?.goToStep(within as number)
        else deck?.goTo(at, within ?? undefined)
      },
      { at: slide ?? null, within: step ?? null }
    )
  }

  /* Let the type settle: the deck shrinks its own text to fit (R5), and a
     screenshot taken before the fonts land shows the wrong size. */
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)

  const report = await state(page)
  const heading = await page.evaluate(() => {
    const shadow = (document.querySelector('#deck') as HTMLElement).shadowRoot
    return (
      shadow
        ?.querySelector(
          'section.slide[data-active] h1, section.slide[data-active] h2, section.slide[data-active] h3'
        )
        ?.textContent?.trim() ?? ''
    )
  })

  if (shot) {
    if (report.mode === 'present') await page.screenshot({ path: shot })
    else await page.locator('#deck').screenshot({ path: shot })
  }

  if (asJson) {
    console.log(JSON.stringify({ ...report, heading, shot: shot ?? null }, null, 2))
  } else {
    const row = (label: string, value: unknown) =>
      console.log(`${label.padEnd(11)}${String(value)}`)
    row('url', url)
    row('mode', `${report.mode}   theme ${report.theme ?? '(none)'}`)
    row(
      'slide',
      `${report.index + 1}/${report.count}   step ${report.step + 1}/${report.stepCount}`
    )
    row('heading', heading)
    row('type', `${report.typePx}px`)
    row('clipped', `${report.clipped}px vertically, ${report.clippedHorizontally}px horizontally`)
    row(
      'box',
      `host ${Math.round(report.box.width)}x${Math.round(report.box.height)}, surface ${Math.round(report.surface.width)}x${Math.round(report.surface.height)} ${report.surface.position}`
    )
    row('counter', `${report.counter}   live "${report.live}"`)
    row('highlight', `${report.activeLines} line(s), ${report.hiddenCode} block(s) hidden`)
    row('visible', report.visible.join(' '))
    row('host', report.hostStatus)
    if (shot) row('shot', shot)
  }
} finally {
  await browser.close()
  stopServer()
}
