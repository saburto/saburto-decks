/**
 * Build-time transform: turns each top-level `---` in the MDX source into a
 * slide boundary.
 *
 * Authoring stays plain Markdown. `---` is a thematic break in Markdown, which
 * is exactly the semantics we want, so no custom syntax is introduced.
 */

/** Minimal mdast/mdxast node shape — we only touch these node types. */
export interface MdastNode {
  type: string
  children?: MdastNode[]
  [key: string]: unknown
}

/** A node that MDX compiles to `<Slide>` / `_components.Slide`. */
const SLIDE_COMPONENT = 'Slide'

/** Markdown's horizontal rule. */
const BREAK = 'thematicBreak'

/** Nodes that describe the deck rather than its slides, and so stay at the
 * root of the tree where the frontmatter plugin expects to find them. */
const DECK_LEVEL = new Set(['yaml'])

/**
 * Groups top-level nodes into `<Slide>` elements at every thematic break.
 *
 * Exported separately from the plugin so it can be unit tested without a
 * Markdown parser.
 */
export function splitSlides(children: readonly MdastNode[]): MdastNode[] {
  const groups: MdastNode[][] = []
  let current: MdastNode[] = []

  for (const child of children) {
    if (child.type === BREAK) {
      if (current.length > 0) groups.push(current)
      current = []
      continue
    }
    current.push(child)
  }
  if (current.length > 0) groups.push(current)

  return groups.map((children, index) => ({
    type: 'mdxJsxFlowElement',
    name: SLIDE_COMPONENT,
    attributes: [{ type: 'mdxJsxAttribute', name: 'index', value: String(index) }],
    children
  }))
}

/**
 * remark plugin. Wrap in `remarkPlugins` when compiling MDX, after
 * `remark-frontmatter`.
 */
export function remarkSlides() {
  return (tree: MdastNode): undefined => {
    const root: MdastNode[] = []
    const content: MdastNode[] = []

    for (const child of tree.children ?? []) {
      ;(DECK_LEVEL.has(child.type) ? root : content).push(child)
    }

    tree.children = [...root, ...splitSlides(content)]
    return undefined
  }
}

export default remarkSlides
