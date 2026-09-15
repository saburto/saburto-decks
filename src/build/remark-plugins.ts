import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import remarkImports from './remark-imports.ts'
import remarkMermaid from './remark-mermaid.ts'
import remarkPalette from './remark-palette.ts'
import remarkSlides from './remark-slides.ts'

/**
 * The remark pipeline every deck is compiled with, in the one order that works:
 *
 * 1. `remark-frontmatter` — parse the YAML block. MDX v3 no longer does this
 *    for you, and without it `---` becomes a setext heading.
 * 2. `remark-mdx-frontmatter` — turn that block into `export const frontmatter`.
 * 3. `remark-imports` — turn an include of another file into an import of it,
 *    and leave the number of slides it brings on the element (R18).
 * 4. `remark-mermaid` — turn a ```mermaid fence into a `<Mermaid>` element,
 *    before `remark-slides` wraps it into a slide (R13).
 * 5. `remark-slides` — wrap the remaining content into `<Slide>` elements,
 *    numbering them in the deck the includes have made.
 * 6. `remark-palette` — give a deck that declares a palette the style element
 *    that applies it (R20). Last, so the element is the deck's and not a
 *    slide's.
 */
export const remarkDeckPlugins = [
  remarkFrontmatter,
  remarkMdxFrontmatter,
  remarkImports,
  remarkMermaid,
  remarkSlides,
  remarkPalette
]
