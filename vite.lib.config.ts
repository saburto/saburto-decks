import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

/**
 * The package build.
 *
 * ESM only, and everything bare stays external: React is a peer dependency of
 * the host's project, and the MDX pipeline belongs to whoever is doing the
 * building. A deck must not carry a second copy of React, and must not carry a
 * compiler into the browser.
 *
 * Two entries, because the two halves have different audiences: `index` is the
 * component a page renders, `mdx` is the plugin a build config uses.
 */
export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    /* A library is minified by whoever consumes it. */
    minify: false,
    lib: {
      entry: { index: 'src/index.ts', mdx: 'src/mdx.ts' },
      formats: ['es']
    },
    rollupOptions: {
      external: (id) => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0')
    }
  }
})
