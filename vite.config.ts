import { defineConfig } from 'vite'
import mdx from '@mdx-js/rollup'
/* Explicit extension: Vite's native config loader, which becomes the default
   in a future major, resolves this import itself rather than bundling it. */
import { remarkDeckPlugins } from './src/build/remark-plugins.ts'

export default defineConfig({
  plugins: [
    // `enforce: 'pre'` so the MDX source is compiled before anything else
    // looks at the file.
    { ...mdx({ remarkPlugins: remarkDeckPlugins }), enforce: 'pre' }
  ],

  esbuild: { jsx: 'automatic' },

  /* Vite does not replace `process.env.NODE_ENV` in library mode, on the
     grounds that a library cannot know its consumer. A deck bundle is not a
     library: it is a complete, self-contained artifact, so it resolves the
     check at build time. Without this, both the development and production
     builds of React are shipped. */
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },

  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    /* One self-contained IIFE per deck: the host page embeds it with a plain
       <script> tag and needs no build step, bundler or framework of its own
       (R4). Everything ends up in this one file — no separate CSS request. */
    lib: {
      entry: 'decks/example.deck.ts',
      name: 'SaburtoDecksExample',
      formats: ['iife'],
      fileName: () => 'example.deck.js'
    }
  }
})
