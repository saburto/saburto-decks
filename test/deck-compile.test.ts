/**
 * Compiles the demo's real deck file through the real plugin pipeline. This is
 * the test that catches plugin-order regressions — frontmatter being parsed as
 * a setext heading, the slides never being wrapped at all, or a code block
 * reaching the page unhighlighted.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { compile } from '@mdx-js/mdx'
import { remarkDeckPlugins } from '../src/build/remark-plugins'
import { rehypeDeckPlugins } from '../src/build/rehype-plugins'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/** Compiles a deck file the way a host's build does: from its own path, so an
 * include of another file resolves the way it does in a real build. */
const compileDeck = async (path: string) =>
  String(
    (
      await compile(
        { value: readFileSync(path, 'utf8'), path },
        { remarkPlugins: remarkDeckPlugins, rehypePlugins: rehypeDeckPlugins }
      )
    ).value
  )

const output = await compileDeck(here('../decks/example.mdx'))

describe('the demo deck', () => {
  test('has twenty-three slides, two of them from an included file', async () => {
    /* The deck's own file holds the other twenty-one: its nineteen slides, the
       slide the nested include sits in, and the arrows slide. The two the
       include brings are compiled with the included file (R18). */
    expect(output.match(/_jsxs?\(Slide,/g)).toHaveLength(21)
    const included = await compileDeck(here('../decks/reused/imported.mdx'))
    expect(included.match(/_jsxs?\(Slide,/g)).toHaveLength(2)
    expect(output).toContain('_missingMdxReference("Slide"')
  })

  test('its frontmatter becomes deck metadata, not content', () => {
    expect(output).toContain('export const frontmatter = {')
    expect(output).toContain('"title": "Saburto Decks"')
    // The YAML block must not survive as headings or paragraphs.
    expect(output).not.toContain('title: Saburto Decks')
  })

  test('every slide is addressed by index in document order', () => {
    const indices = Array.from(output.matchAll(/index: "(\d+)"/g), (match) => match[1])
    expect(indices).toEqual([
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
      '11', '12', '13', '14', '15', '16', '17', '18', '21', '22'
    ])
  })

  test('the markdown rules between slides are gone', () => {
    expect(output).not.toContain('_components.hr')
  })
})

describe('code blocks', () => {
  test('are highlighted at build time, with a colour per theme (R11)', () => {
    /* Nothing here needs a highlighter at run time: every token has already
       become a span with its two colours written on it. */
    expect(output).toContain('"--shiki-light"')
    expect(output).toContain('"--shiki-dark"')
    expect(output).toContain('shiki-themes vitesse-light vitesse-dark')
  })

  test('a fence meta names the lines each step highlights (R11, R12)', () => {
    /* `{1|5|hide|none}` is four steps: line 1, line 5, the block hidden, then
       the block shown with nothing highlighted. `{all|4|6|6-7|9|all}` is six. */
    expect(output).toContain('"data-steps": "4"')
    expect(output).toContain('"data-steps": "6"')
    expect(output).toContain('"data-hl": "0"')
    expect(output).toContain('"data-hl": "1"')
    expect(output).toContain('"data-hide": "2"')
  })

  test("uses Shiki's own highlight classes (R11, R12)", () => {
    /* The block and the lines of the first step are marked the way Shiki marks
       them, so stepping only has to move those marks. */
    expect(output).toContain('className: "shiki shiki-themes vitesse-light vitesse-dark has-highlighted"')
    expect(output).toContain('className: "line highlighted"')
  })

  test('a `[filename]` fence meta names the file above the block (R11)', () => {
    expect(output).toContain('className: "sd-code-title"')
    expect(output).toContain('children: "Post.tsx"')
  })

  test('never becomes a scroll container: no horizontal scrolling tab stop (R5)', () => {
    expect(output).not.toContain('tabIndex: "0"')
  })
})

describe('annotations (R15)', () => {
  test('a <Mark> is a component the deck provides, not raw markup', () => {
    expect(output).toContain('_missingMdxReference("Mark"')
    /* Four in the demo deck: a highlight on the title, an underline, a box and
       a circle. */
    expect(output.match(/_jsx\(Mark,/g)).toHaveLength(4)
  })

  test('its type, colour and step survive compilation', () => {
    expect(output).toContain('type: "highlight"')
    expect(output).toContain('type: "underline"')
    expect(output).toContain('type: "box"')
    expect(output).toContain('type: "circle"')
    expect(output).toContain('color: "accent"')
    expect(output).toContain('at: 2')
  })

  test('the marked passage keeps its own markdown', () => {
    expect(output).toContain('_jsx(_components.strong, {')
  })
})

describe('arrows (R19)', () => {
  test('<Arrow> is a component the deck provides, not raw markup', () => {
    expect(output).toContain('_missingMdxReference("Arrow"')
    /* Three in the demo deck: each points at a word on the left, and its block
       appears on the right on the same step. */
    expect(output.match(/_jsx\(Arrow,/g)).toHaveLength(3)
  })

  test('its ends, its look and its step survive compilation', () => {
    expect(output).toContain('from: "[data-id=arrow-file]@left"')
    expect(output).toContain('to: "[data-id=arrow-word-screen]@right"')
    expect(output).toContain('lineStyle: "dashed"')
    expect(output).toContain('headType: "polygon"')
    expect(output).toContain('arc: -0.4')
    /* The slide opens on the text alone; the arrows begin at the second step. */
    expect(output).toContain('at: 4')
  })
})

describe('motion (R16)', () => {
  test('<Appear> and <Move> are components the deck provides, not raw markup', () => {
    expect(output).toContain('_missingMdxReference("Appear"')
    expect(output).toContain('_missingMdxReference("Move"')
    /* One <Move> on the motion slide; four <Appear>: its arriving line and the
       arrows slide's three blocks, which appear one per step. */
    expect(output.match(/_jsxs?\(Appear,/g)).toHaveLength(4)
    expect(output.match(/_jsxs?\(Move,/g)).toHaveLength(1)
  })

  test('their step and their move survive compilation', () => {
    expect(output).toContain('at: 2')
    expect(output).toContain('at: 3')
    expect(output).toContain('x: 120')
  })
})

describe('contents (R17)', () => {
  test('<Contents> is a component the deck provides, not raw markup', () => {
    expect(output).toContain('_missingMdxReference("Contents", true)')
    /* One in the demo deck: the contents slide. */
    expect(output.match(/_jsx\(Contents,/g)).toHaveLength(1)
  })
})

describe('included files (R18)', () => {
  test('the deck imports the included file instead of copying its text', () => {
    expect(output).toContain('import __saburto_slides_1 from "./reused/imported.mdx"')
    expect(output).toContain('import __saburto_slides_2 from "./reused/inline.mdx"')
    /* The included file's own picture import belongs to the included module,
       where it resolves against that file's own folder. */
    expect(output).not.toContain("'../layout-picture.svg'")
  })

  test('an include on a slide of its own brings its slides into the deck', () => {
    /* The element stays where the author put it, with the deck position its
       slides begin at: nineteen slides before it. */
    expect(output).toContain('_jsx(Slides, {')
    expect(output).toContain('src: __saburto_slides_1')
    expect(output).toContain('offset: "19"')
  })

  test('an include inside a slide is content, not slides of its own', () => {
    /* The slide around it is numbered for the two slides the include before it
       brings, and the nested include has no place in the deck. */
    expect(output).toContain('index: "21"')
    expect(output).toContain('src: __saburto_slides_2')
  })

  test('the included file compiles as a deck of its own', async () => {
    const included = await compileDeck(here('../decks/reused/imported.mdx'))

    expect(included).toContain("import picture from '../layout-picture.svg'")
  })
})

describe('diagrams', () => {
  test('a mermaid fence becomes a Mermaid element, not code (R13)', () => {
    /* Five fences in the demo deck: a sequence diagram, a flowchart, a state
       diagram, a class diagram and a flowchart inside a column. */
    expect(output.match(/_jsx\(Mermaid,/g)).toHaveLength(5)
    expect(output).toContain('_missingMdxReference("Mermaid"')
    /* The source is carried through as the element's child... */
    expect(output).toContain('sequenceDiagram\\n')
    expect(output).toContain('flowchart LR\\n')
    expect(output).toContain('stateDiagram-v2\\n')
    expect(output).toContain('classDiagram\\n')
    /* ...and is never handed to the highlighter as a language. */
    expect(output).not.toContain('language-mermaid')
  })
})

describe('layouts (R5)', () => {
  test('every layout component is one the deck provides, not raw markup', () => {
    for (const name of ['Columns', 'Grid', 'Block', 'Stack', 'Figure', 'Bullets']) {
      expect(output).toContain(`_missingMdxReference("${name}"`)
    }
  })

  test('the demo deck uses each of the typical layouts', () => {
    /* The picture column and the bullets are one each; the diagram beside a
       column's text is the deck's fifth diagram. */
    expect(output.match(/_jsx\(Figure,/g)).toHaveLength(1)
    expect(output.match(/_jsx\(Bullets,/g)).toHaveLength(1)
    expect(output.match(/_jsxs?\(Grid,/g)).toHaveLength(2)
    expect(output.match(/_jsxs?\(Stack,/g)).toHaveLength(4)
  })

  test('a picture is imported, so a deck carries its own assets', () => {
    expect(output).toContain("import picture from './layout-picture.svg'")
  })
})
