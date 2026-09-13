import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { saburtoDecks } from '../src/mdx.ts'

/**
 * The second demo host: a plain React app, no Astro.
 *
 * It exists to show — and to test — that a deck is a React component and
 * nothing more: the same `Deck` and the same deck file, in a page that has
 * never heard of Astro.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [tailwindcss(), saburtoDecks()],
  esbuild: { jsx: 'automatic' },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  server: { port: 4174 },
  preview: { port: 4174 }
})
