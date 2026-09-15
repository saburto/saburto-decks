/**
 * The small mdast/mdxast vocabulary the deck's build plugins share.
 *
 * Every plugin here reads and rewrites the same tree, so the pieces that are
 * not about any one transform live in one place: the node shape, reading an
 * element's attributes, walking the tree, and building the handful of nodes a
 * plugin has to insert. A plugin that uses them reads as the transform it is
 * — "find the includes and rewrite them" — rather than as node-literal
 * plumbing, and a change to the shape is felt in one file.
 *
 * Everything here is pure and takes plain objects, so each helper has its own
 * unit test.
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

/** The attribute `name` of an MDX element, if it has one. */
export function attribute(node: MdastNode, name: string): MdastNode | undefined {
  return node.attributes?.find((candidate) => candidate.name === name)
}

/** The value of an attribute written as a plain string, when it is one. */
export function stringAttribute(node: MdastNode, name: string): string | undefined {
  const found = attribute(node, name)
  return typeof found?.value === 'string' ? found.value : undefined
}

/**
 * Visits a node and everything under it, parents before children.
 *
 * Mutation is safe: the walk holds no copy of the tree, so a visitor may
 * rewrite it as it goes — which is how each plugin does its work. It is
 * `undefined` for a leaf.
 */
export function walk(node: MdastNode, visit: (node: MdastNode) => void): void {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

/** An MDX attribute written as a plain string. */
export function jsxAttribute(name: string, value: string): MdastNode {
  return { type: 'mdxJsxAttribute', name, value }
}

/** An MDX attribute whose value is a JavaScript expression from the module. */
export function expressionAttribute(name: string, value: string): MdastNode {
  return {
    type: 'mdxJsxAttribute',
    name,
    value: {
      type: 'mdxJsxAttributeValueExpression',
      value,
      data: { estree: estreeProgram(estreeIdentifier(value)) }
    }
  }
}

/** An MDX element. */
export function jsxElement(
  name: string,
  options: { attributes?: MdastNode[]; children?: MdastNode[]; type?: string } = {}
): MdastNode {
  return {
    type: options.type ?? 'mdxJsxFlowElement',
    name,
    attributes: options.attributes ?? [],
    children: options.children ?? []
  }
}

/** A text node. */
export function textNode(value: string): MdastNode {
  return { type: 'text', value }
}

/** An estree identifier, used inside the programs MDX is handed. */
export function estreeIdentifier(name: string): Record<string, unknown> {
  return { type: 'Identifier', name }
}

/** The estree program MDX needs beside an expression it did not parse itself. */
export function estreeProgram(expression: unknown): Record<string, unknown> {
  return {
    type: 'Program',
    sourceType: 'module',
    body: [{ type: 'ExpressionStatement', expression }]
  }
}

/**
 * A default import of `source`, bound to `binding`, as an ESM node MDX can
 * compile — the text and the estree tree it stands for.
 */
export function esmDefaultImport(binding: string, source: string): MdastNode {
  const quoted = JSON.stringify(source)
  return {
    type: 'mdxjsEsm',
    value: `import ${binding} from ${quoted}`,
    data: {
      estree: {
        type: 'Program',
        sourceType: 'module',
        body: [
          {
            type: 'ImportDeclaration',
            specifiers: [{ type: 'ImportDefaultSpecifier', local: estreeIdentifier(binding) }],
            source: { type: 'Literal', value: source, raw: quoted }
          }
        ]
      }
    }
  }
}
