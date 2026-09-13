declare module '*.mdx' {
  import type { ComponentType } from 'react'

  const MDXContent: ComponentType<Record<string, unknown>>
  export default MDXContent

  /** Injected by `remark-mdx-frontmatter` — the deck's own metadata. */
  export const frontmatter: Record<string, unknown> | undefined
}

/** Vite hands a stylesheet imported with `?inline` back as a string. */
declare module '*.css?inline' {
  const css: string
  export default css
}
