/**
 * Build-time transform: turns each top-level `---` in the MDX source into a
 * slide boundary, and leaves an include of another file's slides where its
 * author put it (R18).
 *
 * Authoring stays plain Markdown. `---` is a thematic break in Markdown, which
 * is exactly the semantics we want, so no custom syntax is introduced.
 */

/** Minimal mdast/mdxast node shape — we only touch these node types. */
export interface MdastNode {
  type: string
  name?: string
  value?: unknown
  children?: MdastNode[]
  attributes?: MdastNode[]
  data?: Record<string, unknown>
  position?: unknown
  [key: string]: unknown
}

/** A node that MDX compiles to `<Slide>` / `_components.Slide`. */
const SLIDE_COMPONENT = 'Slide'

/** The element that renders another file's slides (R18). */
const INCLUDE_COMPONENT = 'Slides'

/** Markdown's horizontal rule. */
const BREAK = 'thematicBreak'

/** Nodes that describe the file rather than a slide in it. Frontmatter is
 * hoisted so the frontmatter plugin finds it; imports are left in place and
 * are hoisted out of a slide by MDX itself. */
const FILE_LEVEL = new Set(['yaml', 'mdxjsEsm'])

/** The attribute `name` of an MDX element, if it has one. */
export function attribute(node: MdastNode, name: string): MdastNode | undefined {
  return node.attributes?.find((candidate) => candidate.name === name)
}

/** The value of an attribute written as a plain string, when it is one. */
export function stringAttribute(node: MdastNode, name: string): string | undefined {
  const found = attribute(node, name)
  return typeof found?.value === 'string' ? found.value : undefined
}

/** Whether a node is the element that includes another file's slides (R18). */
export function isSlidesElement(node: MdastNode | undefined): boolean {
  return node?.type === 'mdxJsxFlowElement' && node.name === INCLUDE_COMPONENT
}

/** Whether a node is an include: the element, with a file named (R18). */
export function isInclude(node: MdastNode | undefined): boolean {
  return isSlidesElement(node) && attribute(node as MdastNode, 'src') !== undefined
}

/** The nodes of a file grouped between slide breaks, without wrapping them.
 * Exported because counting another file's slides needs the same grouping the
 * deck itself is built with. */
export function slideGroups(children: readonly MdastNode[]): MdastNode[][] {
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

  return groups
}

/** Whether a group is one include and nothing else: a slide that is another
 * file's slides rather than a slide of its own (R18). */
export function isIncludeOnly(group: readonly MdastNode[]): boolean {
  const content = group.filter((node) => !FILE_LEVEL.has(node.type))
  return content.length === 1 && isInclude(content[0])
}

/** The include's own element, wherever in a group it sits. */
export function includeIn(group: readonly MdastNode[]): MdastNode {
  return group.find((node) => isInclude(node)) as MdastNode
}

/** How many slides an include brings: counted while `remark-imports` resolved
 * the file (R18). */
function includedCount(node: MdastNode): number {
  const count = node.data?.['sdSlides']
  return typeof count === 'number' && count >= 0 ? count : 1
}

/** The include, carrying the deck position its slides begin at (R18). */
function withOffset(node: MdastNode, offset: number): MdastNode {
  const attributes = (node.attributes ?? []).filter((candidate) => candidate.name !== 'offset')
  return {
    ...node,
    attributes: [...attributes, { type: 'mdxJsxAttribute', name: 'offset', value: String(offset) }]
  }
}

/** One slide, wrapped by `index` within the deck. */
function slide(children: MdastNode[], index: number): MdastNode {
  return {
    type: 'mdxJsxFlowElement',
    name: SLIDE_COMPONENT,
    attributes: [{ type: 'mdxJsxAttribute', name: 'index', value: String(index) }],
    children
  }
}

/**
 * Groups top-level nodes into `<Slide>` elements at every thematic break, and
 * leaves a slide that is only an include as the include itself — the position
 * it is at, so the deck it hands its slides to can number them (R18).
 *
 * Exported separately from the plugin so it can be unit tested without a
 * Markdown parser.
 */
export function splitSlides(children: readonly MdastNode[]): MdastNode[] {
  const slides: MdastNode[] = []
  let position = 0

  for (const group of slideGroups(children)) {
    if (isIncludeOnly(group)) {
      const include = includeIn(group)
      /* The file's own imports stay with it; MDX hoists them out of whatever
         they are in. */
      slides.push(...group.filter((node) => node !== include))
      slides.push(withOffset(include, position))
      position += includedCount(include)
      continue
    }

    slides.push(slide(group, position))
    position += 1
  }

  return slides
}

/**
 * remark plugin. Wrap in `remarkPlugins` when compiling MDX, after
 * `remark-frontmatter` and after `remark-imports`, which counts the slides an
 * include brings.
 */
export function remarkSlides() {
  return (tree: MdastNode): undefined => {
    const root: MdastNode[] = []
    const content: MdastNode[] = []

    for (const child of tree.children ?? []) {
      ;(child.type === 'yaml' ? root : content).push(child)
    }

    tree.children = [...root, ...splitSlides(content)]
    return undefined
  }
}

export default remarkSlides
