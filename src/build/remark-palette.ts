/**
 * Build-time transform: a deck file that declares a palette is given the
 * stylesheet that applies it (R20).
 *
 * The palette is read from the frontmatter the pipeline has already parsed —
 * the `frontmatter` export `remark-mdx-frontmatter` leaves in the module — and
 * turned into `:host` rules, here, at build time. Nothing about the palette but
 * the finished CSS reaches the browser, exactly as nothing but finished markup
 * reaches it for a code block (R11).
 *
 * The rules are `:host` rules on purpose. A host page's own colours are set on
 * the deck's element, in the page's tree, and the outer tree beats `:host` for
 * the element itself — so a host keeps the last word without doing anything
 * special (R8). A deck's *own* stylesheet comes after this one and so can
 * correct a single colour of its palette.
 *
 * The element is added to the deck rather than to a slide, and runs last in the
 * pipeline so that is where it lands: `remark-slides` has already wrapped the
 * slides by then.
 */
import { estreeProgram, jsxElement, walk, type MdastNode } from './ast.ts'

/** The colours a palette may name, and the deck variable each one sets. */
export const PALETTE_TOKENS = {
  bg: '--sd-bg',
  fg: '--sd-fg',
  muted: '--sd-muted',
  border: '--sd-border',
  accent: '--sd-accent',
  surface: '--sd-surface',
  highlight: '--sd-highlight'
} as const

/** One set of colours: a light set or a dark one. */
export type PaletteColours = Partial<Record<keyof typeof PALETTE_TOKENS, string>>

/** The palette a deck may declare: the colours to draw it in, per theme. */
export interface DeckPalette {
  light?: PaletteColours
  dark?: PaletteColours
}

/**
 * A colour as it can be written into a declaration, or nothing.
 *
 * A colour can be written many ways — a hex, an `oklch()`, a `var()` — so the
 * question is not "is this a colour?" but "can this leave the declaration it is
 * in?". Anything that could end the declaration, the block or the element is
 * refused, and the colour it named is left out rather than written in broken.
 */
export function usableColour(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const colour = value.trim()
  if (colour === '') return undefined
  return /[;{}<>]|\/\*/.test(colour) ? undefined : colour
}

/** The colours of one set that can be written, as token/variable pairs. */
function declarations(set: PaletteColours | undefined): string[] {
  const written: string[] = []
  for (const [colour, variable] of Object.entries(PALETTE_TOKENS)) {
    const value = usableColour((set as Record<string, unknown> | undefined)?.[colour])
    if (value !== undefined) written.push(`  ${variable}: ${value};`)
  }
  return written
}

/** One rule block for a set of colours, or nothing when it names none. */
function block(selector: string, set: PaletteColours | undefined): string {
  const written = declarations(set)
  if (written.length === 0) return ''
  return `${selector} {\n${written.join('\n')}\n}`
}

/** Every line of a block, indented, for a block nested in a media query. */
const indented = (css: string) =>
  css
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')

/**
 * The stylesheet a palette stands for (R20), or nothing when it names no colour
 * that can be written.
 *
 * The light set applies to the deck; the dark set applies when the host asked
 * for the dark theme, and again when the host asked for the system theme and
 * the reader prefers dark — the same three cases the deck's own palette is
 * written in.
 */
export function paletteCss(palette: DeckPalette): string {
  const light = block(':host', palette.light)
  const dark = block(":host([data-theme='dark'])", palette.dark)
  const system = block(":host([data-theme='system'])", palette.dark)

  const rules = [
    light,
    dark,
    system && `@media (prefers-color-scheme: dark) {\n${indented(system)}\n}`
  ]
    .filter((rule) => rule !== '')
    .join('\n')

  return rules === '' ? '' : `/* The palette this deck declares (R20). */\n${rules}\n`
}

/** The value an ESTree literal stands for, when it is a literal at all. */
function literal(node: MdastNode | undefined): unknown {
  if (!node || typeof node !== 'object') return undefined

  if (node.type === 'Literal') return node.value

  if (node.type === 'ObjectExpression') {
    const value: Record<string, unknown> = {}
    for (const property of (node.properties as MdastNode[] | undefined) ?? []) {
      const key = property.key as MdastNode | undefined
      const name =
        key?.type === 'Identifier'
          ? key.name
          : key?.type === 'Literal'
            ? String(key.value)
            : undefined
      if (property.type === 'Property' && name !== undefined) {
        value[name] = literal(property.value as MdastNode | undefined)
      }
    }
    return value
  }

  return undefined
}

/** The deck's frontmatter, read back out of the module the pipeline built. */
function frontmatter(tree: MdastNode): Record<string, unknown> | undefined {
  let declared: Record<string, unknown> | undefined

  walk(tree, (node) => {
    if (declared !== undefined || node.type !== 'mdxjsEsm') return
    const program = node.data?.['estree'] as MdastNode | undefined

    for (const statement of (program?.body as MdastNode[] | undefined) ?? []) {
      /* The pipeline writes it as `export const frontmatter = {…}`, so the
         declaration sits inside the export. */
      const declaration = statement.declaration as MdastNode | undefined
      if (
        statement.type !== 'ExportNamedDeclaration' ||
        declaration?.type !== 'VariableDeclaration'
      ) {
        continue
      }
      for (const declarator of (declaration.declarations as MdastNode[] | undefined) ?? []) {
        const id = declarator.id as MdastNode | undefined
        if (id?.name !== 'frontmatter') continue
        const value = literal(declarator.init as MdastNode | undefined)
        if (value !== null && typeof value === 'object') {
          declared = value as Record<string, unknown>
        }
      }
    }
  })

  return declared
}

/** One set of colours, as far as it can be read and written. */
function colours(set: unknown): PaletteColours | undefined {
  if (set === null || typeof set !== 'object') return undefined
  const declared: Record<string, string> = {}
  for (const colour of Object.keys(PALETTE_TOKENS)) {
    const value = usableColour((set as Record<string, unknown>)[colour])
    if (value !== undefined) declared[colour] = value
  }
  return Object.keys(declared).length > 0 ? (declared as PaletteColours) : undefined
}

/**
 * The palette a deck declares, if it declares one: only the colours it can
 * actually be drawn in. A deck with no frontmatter, no `palette`, or no usable
 * colour in it has no palette.
 */
export function declaredPalette(tree: MdastNode): DeckPalette | undefined {
  const palette = frontmatter(tree)?.['palette']
  if (palette === null || typeof palette !== 'object') return undefined

  const sets = palette as Record<string, unknown>
  const declared: DeckPalette = {}
  const light = colours(sets['light'])
  const dark = colours(sets['dark'])
  if (light) declared.light = light
  if (dark) declared.dark = dark

  return declared.light === undefined && declared.dark === undefined ? undefined : declared
}

/** The `<style>` element a palette is applied with: a raw element, so a deck
 * needs no component of its own to carry one.
 *
 * The CSS is handed over as an expression rather than as the element's text,
 * because MDX trims the leading whitespace of a text child and the stylesheet
 * is written to be read. */
export function paletteStyle(palette: DeckPalette): MdastNode {
  const css = paletteCss(palette)
  return jsxElement('style', {
    children: [
      {
        type: 'mdxTextExpression',
        value: JSON.stringify(css),
        data: { estree: estreeProgram({ type: 'Literal', value: css, raw: JSON.stringify(css) }) }
      }
    ]
  })
}

/**
 * remark plugin. Wrap in `remarkPlugins` *after* `remark-slides`, so that the
 * style element is added to the deck rather than wrapped into its first slide.
 */
export function remarkPalette() {
  return (tree: MdastNode): undefined => {
    const palette = declaredPalette(tree)
    if (!palette) return undefined

    tree.children = [paletteStyle(palette), ...(tree.children ?? [])]
    return undefined
  }
}

export default remarkPalette
