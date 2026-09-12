declare module '*.mdx' {
  import type { ComponentType } from 'react'

  const MDXContent: ComponentType<Record<string, unknown>>
  export default MDXContent

  /** Injected by `remarkSlides`. */
  export const slideCount: number
  /** Injected by `remark-mdx-frontmatter`. */
  export const frontmatter: Record<string, unknown> | undefined
}
