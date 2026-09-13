/**
 * Compiles the demo's real deck file through the real plugin pipeline. This is
 * the test that catches plugin-order regressions — frontmatter being parsed as
 * a setext heading, the slides never being wrapped at all, or a code block
 * reaching the page unhighlighted.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { compile } from '@mdx-js/mdx'
import { remarkDeckPlugins } from '../src/build/remark-plugins'
import { rehypeDeckPlugins } from '../src/build/rehype-plugins'

const source = readFileSync(new URL('../decks/example.mdx', import.meta.url), 'utf8')

const compiled = await compile(source, {
  remarkPlugins: remarkDeckPlugins,
  rehypePlugins: rehypeDeckPlugins
})
const output = String(compiled.value)

describe('the demo deck', () => {
  test('has exactly ten slides', () => {
    expect(output.match(/_jsxs?\(Slide,/g)).toHaveLength(10)
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
    expect(indices).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])
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

describe('motion (R16)', () => {
  test('<Appear> and <Move> are components the deck provides, not raw markup', () => {
    expect(output).toContain('_missingMdxReference("Appear"')
    expect(output).toContain('_missingMdxReference("Move"')
    /* One of each in the demo deck. */
    expect(output.match(/_jsxs?\(Appear,/g)).toHaveLength(1)
    expect(output.match(/_jsxs?\(Move,/g)).toHaveLength(1)
  })

  test('their step and their move survive compilation', () => {
    expect(output).toContain('at: 2')
    expect(output).toContain('at: 3')
    expect(output).toContain('x: 120')
  })
})

describe('diagrams', () => {
  test('a mermaid fence becomes a Mermaid element, not code (R13)', () => {
    /* Four fences in the demo deck: a sequence diagram, a flowchart, a state
       diagram and a class diagram. */
    expect(output.match(/_jsx\(Mermaid,/g)).toHaveLength(4)
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
