import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import { saburtoDecks } from '../src/mdx.ts'

/**
 * The demo site: what a host page looks like when it embeds a deck.
 *
 * Two things are needed, and this is both of them: `@astrojs/react`, because a
 * deck is a React component, and the deck pipeline — Astro's own MDX
 * integration compiles MDX to Astro components, which is not what a deck is.
 */
export default defineConfig({
  integrations: [react()],
  vite: { plugins: [saburtoDecks()] }
})
