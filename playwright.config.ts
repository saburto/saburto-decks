import { defineConfig } from '@playwright/test'

/**
 * End-to-end tests: they drive a real Astro page that embeds a deck, in a real
 * browser, and assert the behaviour the requirements actually promise.
 *
 * `channel: 'chromium'` selects the full Chromium build (rather than the
 * separate headless shell) and WebKit and Firefox projects are deliberately
 * absent: the browser revisions they would need are not in the local cache, so
 * configuring them would mean downloading browsers. Nothing here is Firefox- or
 * Safari-specific — the tests assert standards-level behaviour.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    channel: 'chromium',
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure'
  },
  webServer: [
    /* Both demos, because there are two host shapes to prove: an Astro page
       and a plain React app. The tests drive the built sites, so `build` must
       have run. */
    {
      command: 'bun run preview',
      url: 'http://127.0.0.1:4173/',
      reuseExistingServer: !process.env['CI'],
      stdout: 'ignore'
    },
    {
      command: 'bun run preview:react',
      url: 'http://127.0.0.1:4174/',
      reuseExistingServer: !process.env['CI'],
      stdout: 'ignore'
    }
  ]
})
