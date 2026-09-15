/**
 * Build-time transform: turns `<Slides src="./part.mdx" />` into an import of
 * that file and the element that renders it (R18).
 *
 * The included file stays a file of its own — the include becomes a real
 * `import`, not a copy of its text. That is what makes the rest work: the
 * file's own pictures and imports resolve from its own folder, and Vite knows
 * the deck depends on it, so editing it reloads the deck being developed.
 *
 * Which slides the include is worth — all of them, numbered from the deck
 * position the include sits at — is decided here and in `remark-slides`; this
 * plugin only resolves the file, counts its slides, and rewrites the element
 * to render the compiled module.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createProcessor } from '@mdx-js/mdx'
import remarkFrontmatter from 'remark-frontmatter'
import {
  attribute,
  includeIn,
  isIncludeOnly,
  isSlidesElement,
  slideGroups,
  stringAttribute,
  type MdastNode
} from './remark-slides.ts'

/** Every include binds its own name, so two files in one deck cannot clash. */
const BINDING = `__saburto_slides_`

/** What the plugin needs of the build's VFile: where the deck is, and a
 * positioned way to fail. */
interface DeckFile {
  path?: string
  fail(reason: string, place?: unknown, origin?: string): never
}

/** How an included file's text is read. A test supplies its own. */
export type ReadInclude = (path: string) => string

export interface ImportOptions {
  /** How an included file's text is read (defaults to the filesystem). */
  read?: ReadInclude
}

/** Parses an included file far enough to count its slides. MDX because that is
 * what a deck is, and frontmatter because a deck may carry it. */
const parseFile = createProcessor({ remarkPlugins: [remarkFrontmatter] })

const identifier = (name: string) => ({ type: 'Identifier', name })

/** The estree MDX needs beside an expression it did not parse itself. */
const expressionProgram = (expression: unknown) => ({
  type: 'Program',
  sourceType: 'module',
  body: [{ type: 'ExpressionStatement', expression }]
})

/** The import of an included file: the text and the tree MDX compiles. */
function importNode(binding: string, src: string): MdastNode {
  const quoted = JSON.stringify(src)
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
            specifiers: [{ type: 'ImportDefaultSpecifier', local: identifier(binding) }],
            source: { type: 'Literal', value: src, raw: quoted }
          }
        ]
      }
    }
  }
}

/** The include element, rewritten to render the compiled module. */
function renderElement(node: MdastNode, binding: string, count: number): void {
  node.attributes = [
    ...(node.attributes ?? []).filter((candidate) => candidate.name !== 'src'),
    {
      type: 'mdxJsxAttribute',
      name: 'src',
      value: {
        type: 'mdxJsxAttributeValueExpression',
        value: binding,
        data: { estree: expressionProgram(identifier(binding)) }
      }
    }
  ]
  node.data = { ...node.data, sdSlides: count }
}

/**
 * How many slides a file brings into the deck that includes it: its own, and,
 * for a slide that is itself an include, everything that include brings (R18).
 *
 * `ancestors` is the chain of files that led here, so a file that includes
 * itself — directly or through another file — is reported rather than read
 * forever.
 */
export function includedSlides(
  path: string,
  ancestors: ReadonlySet<string>,
  read: ReadInclude
): number {
  if (ancestors.has(path)) {
    throw new Error(`a deck cannot include itself (${[...ancestors, path].join(' → ')})`)
  }

  let source: string
  try {
    source = read(path)
  } catch {
    throw new Error(`included file not found: ${path}`)
  }

  const tree = parseFile.parse(source) as unknown as MdastNode
  let total = 0

  /* Frontmatter describes the file being included; only its slides are used. */
  for (const group of slideGroups((tree.children ?? []).filter((node) => node.type !== 'yaml'))) {
    if (isIncludeOnly(group)) {
      const include = includeIn(group)
      const src = stringAttribute(include, 'src')
      if (src === undefined) throw new Error(`an include in ${path} has no src`)
      total += includedSlides(resolve(dirname(path), src), new Set([...ancestors, path]), read)
      continue
    }
    total += 1
  }

  return total
}

/** Visits a node and everything under it. */
function walk(node: MdastNode, visit: (node: MdastNode) => void): void {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

/**
 * remark plugin. Wrap in `remarkPlugins` when compiling MDX, before
 * `remark-slides`, which needs the count this plugin leaves on the element.
 */
export function remarkImports(options: ImportOptions = {}) {
  const read = options.read ?? ((path: string) => readFileSync(path, 'utf8'))

  return (tree: MdastNode, file: DeckFile): undefined => {
    const path = file.path
    const imports: { binding: string; src: string }[] = []
    const included = new Map<string, { binding: string; count: number }>()
    let bound = 0

    const include = (node: MdastNode): void => {
      const named = attribute(node, 'src')
      if (named && typeof named.value !== 'string') {
        file.fail(
          '<Slides> takes a file name written as a string, like <Slides src="./part.mdx" />',
          node,
          'remark-imports'
        )
      }

      const src = stringAttribute(node, 'src')
      if (src === undefined) {
        file.fail(
          '<Slides> needs a src written as a relative path, like <Slides src="./part.mdx" />',
          node,
          'remark-imports'
        )
      }
      if (!path) {
        file.fail(
          'a deck that includes another file needs a file of its own to resolve it from',
          node,
          'remark-imports'
        )
      }
      if (!src.startsWith('./') && !src.startsWith('../')) {
        file.fail(
          `<Slides src="${src}" /> has to be a relative path, like "./part.mdx"`,
          node,
          'remark-imports'
        )
      }

      const resolved = resolve(dirname(path), src)
      let entry = included.get(resolved)
      if (!entry) {
        bound += 1
        const binding = `${BINDING}${bound}`
        try {
          entry = { binding, count: includedSlides(resolved, new Set([path]), read) }
        } catch (error) {
          file.fail(error instanceof Error ? error.message : String(error), node, 'remark-imports')
        }
        included.set(resolved, entry)
        imports.push({ binding, src })
      }

      renderElement(node, entry.binding, entry.count)
    }

    walk(tree, (node) => {
      if (node.type === 'mdxJsxTextElement' && node.name === 'Slides') {
        file.fail(
          '<Slides> includes a whole file of slides, so it has to stand on a slide of its own',
          node,
          'remark-imports'
        )
      }
      if (isSlidesElement(node)) include(node)
    })

    /* MDX hoists imports wherever they are, but the deck's own file reads
       better with them at the top. */
    if (imports.length > 0) {
      tree.children = [...imports.map(({ binding, src }) => importNode(binding, src)), ...(tree.children ?? [])]
    }

    return undefined
  }
}

export default remarkImports
