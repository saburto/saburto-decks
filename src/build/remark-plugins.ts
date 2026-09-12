import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import remarkSlides from './remark-slides.ts'

/**
 * The remark pipeline every deck is compiled with, in the one order that works:
 *
 * 1. `remark-frontmatter` — parse the YAML block. MDX v3 no longer does this
 *    for you, and without it `---` becomes a setext heading.
 * 2. `remark-mdx-frontmatter` — turn that block into `export const frontmatter`.
 * 3. `remark-slides` — wrap the remaining content into `<Slide>` elements and
 *    export the slide count.
 */
export const remarkDeckPlugins = [remarkFrontmatter, remarkMdxFrontmatter, remarkSlides]
