import { defineConfig } from '@playwright/test'

/**
 * End-to-end tests: they drive the real demo host page in a real browser, and
 * assert the behaviour the requirements actually promise — a deck embedded in
 * a page, presenting full screen, and the place it was left in.
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
  webServer: {
    command: 'bun run scripts/serve.ts',
    url: 'http://127.0.0.1:4173/demo/',
    reuseExistingServer: !process.env['CI'],
    stdout: 'ignore'
  }
})
