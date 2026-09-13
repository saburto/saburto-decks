/**
 * Build-time transform: a ```mermaid fence becomes a `<Mermaid>` element the
 * deck renders, carrying the diagram's source.
 *
 * The diagram itself is drawn in the browser — Mermaid needs a real DOM to lay
 * a diagram out, and the source cannot be rendered anywhere else — so the
 * build has only to stop treating the fence as code and hand the source over
 * (R13). A fence whose meta says `full` is drawn whole rather than revealed a
 * step at a time (R14).
 */
import type { MdastNode } from './remark-slides.ts'

/** The fence language a diagram is written with. */
const MERMAID = 'mermaid'

/** `mermaid {full}` — the diagram is not revealed element by element. */
const FULL = /\bfull\b/

/** True for a fenced code block whose language is `mermaid`. */
export function isMermaid(node: MdastNode): boolean {
  return node.type === 'code' && node.lang === MERMAID
}

/** True when the fence's meta asks for the whole diagram at once. */
export function wantsWholeDiagram(node: MdastNode): boolean {
  return FULL.test(String(node.meta ?? ''))
}

/**
 * The `<Mermaid>` element a diagram fence compiles to, with its source as the
 * element's only child. The source is a text child rather than an attribute so
 * that newlines and punctuation reach the component exactly as written.
 */
export function mermaidElement(node: MdastNode): MdastNode {
  return {
    type: 'mdxJsxFlowElement',
    name: 'Mermaid',
    attributes: wantsWholeDiagram(node)
      ? [{ type: 'mdxJsxAttribute', name: 'data-full', value: 'true' }]
      : [],
    children: [{ type: 'text', value: String(node.value ?? '') }]
  }
}

/**
 * remark plugin. Turns every mermaid code node into a `<Mermaid>` element,
 * wherever it sits — a slide, or a block quote inside one.
 */
export function remarkMermaid() {
  return (tree: MdastNode): undefined => {
    const walk = (node: MdastNode): void => {
      const children = node.children
      if (!children) return
      for (let position = 0; position < children.length; position++) {
        const child = children[position]
        if (!child) continue
        if (isMermaid(child)) children[position] = mermaidElement(child)
        else walk(child)
      }
    }
    walk(tree)
    return undefined
  }
}

export default remarkMermaid
