declare module '*.mdx' {
  import type { ComponentType } from 'react'

  const MDXContent: ComponentType<Record<string, unknown>>
  export default MDXContent

  /** Injected by `remark-mdx-frontmatter` — the deck's own metadata. */
  export const frontmatter: Record<string, unknown> | undefined
}
