/**
 * The build half of the package: how a deck file becomes a React component.
 *
 * A deck is MDX, and it has to compile to *React*, because the deck component
 * is a React component. Astro's own MDX integration does not help here — it
 * compiles MDX to Astro components — so this plugin brings its own MDX
 * pipeline, with the remark plugins that make `---` mean "next slide" and the
 * rehype plugin that highlights code.
 *
 * One line in the host's config:
 *
 *   import { saburtoDecks } from '@saburto/saburto-decks/mdx'
 *   export default defineConfig({ vite: { plugins: [saburtoDecks()] } })
 */
import mdx from '@mdx-js/rollup'
import { remarkDeckPlugins } from './build/remark-plugins.ts'
import { rehypeDeckPlugins } from './build/rehype-plugins.ts'

export { remarkDeckPlugins } from './build/remark-plugins.ts'
export { rehypeDeckPlugins } from './build/rehype-plugins.ts'
export { remarkSlides, splitSlides, type MdastNode } from './build/remark-slides.ts'
export { remarkMermaid, isMermaid, wantsWholeDiagram, mermaidElement } from './build/remark-mermaid.ts'

/** Wires deck compilation into a Vite (or Astro) build. */
export function saburtoDecks() {
  return {
    /* `pre` so the MDX source is compiled before anything else looks at it. */
    ...mdx({ remarkPlugins: remarkDeckPlugins, rehypePlugins: rehypeDeckPlugins }),
    enforce: 'pre' as const
  }
}
