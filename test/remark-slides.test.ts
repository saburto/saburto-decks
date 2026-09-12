import { describe, expect, test } from 'bun:test'
import { VFile } from 'vfile'
import { remarkSlides, splitSlides, type MdastNode } from '../src/build/remark-slides'

const run = (tree: MdastNode) => remarkSlides()(tree, new VFile({ path: 'deck.mdx' }))

/** Digs the value of an `export const <name> = <value>` node back out of the
 * generated ESTree, since that is where MDX reads it from. */
function declaredConstant(tree: MdastNode, name: string): unknown {
  const program = tree.children?.[0]?.['data'] as { estree?: EstreeNode } | undefined
  const declaration = program?.estree?.body?.[0]?.declaration?.declarations?.[0]
  if (declaration?.id?.name !== name) throw new Error(`no export named ${name}`)
  return declaration.init?.value
}

interface EstreeNode {
  body?: Array<{
    declaration?: {
      declarations?: Array<{ id?: { name?: string }; init?: { value?: unknown } }>
    }
  }>
}

const p = (text: string): MdastNode => ({ type: 'paragraph', children: [{ type: 'text', value: text }] })
const heading = (text: string): MdastNode => ({ type: 'heading', depth: 1, children: [{ type: 'text', value: text }] })
const break_ = (): MdastNode => ({ type: 'thematicBreak' })

describe('splitSlides', () => {
  test('splits on every thematic break', () => {
    const slides = splitSlides([p('one'), break_(), p('two'), break_(), p('three')])

    expect(slides).toHaveLength(3)
    expect(slides.map((s) => s.children?.length)).toEqual([1, 1, 1])
    expect(slides.every((s) => s.name === 'Slide')).toBe(true)
  })

  test('labels slides with their index as a string attribute', () => {
    const slides = splitSlides([p('one'), break_(), p('two')])

    expect(slides[1]?.attributes).toEqual([
      { type: 'mdxJsxAttribute', name: 'index', value: '1' }
    ])
  })

  test('no break means a single slide', () => {
    expect(splitSlides([heading('only'), p('body')])).toHaveLength(1)
  })

  test('dropping the breaks leaves the content unchanged and ordered', () => {
    const slides = splitSlides([p('a'), break_(), heading('b'), p('c')])

    expect(slides[0]?.children).toEqual([p('a')])
    expect(slides[1]?.children).toEqual([heading('b'), p('c')])
  })

  test('ignores empty slides from leading, trailing or doubled breaks', () => {
    const slides = splitSlides([break_(), p('one'), break_(), break_(), p('two'), break_()])

    expect(slides).toHaveLength(2)
    expect(slides[0]?.children).toEqual([p('one')])
    expect(slides[1]?.children).toEqual([p('two')])
  })

  test('an empty or whitespace-only file yields no slides', () => {
    expect(splitSlides([])).toEqual([])
  })
})

describe('remarkSlides', () => {
  test('replaces the tree children with slides, plus the count export', () => {
    const tree: MdastNode = { type: 'root', children: [p('one'), break_(), p('two')] }

    run(tree)

    expect(tree.children?.map((c) => c.type)).toEqual(['mdxjsEsm', 'mdxJsxFlowElement', 'mdxJsxFlowElement'])
  })

  test('exports a slideCount matching the number of slides emitted', () => {
    const tree: MdastNode = { type: 'root', children: [p('one'), break_(), p('two'), break_(), p('three')] }

    run(tree)

    /* The export is written as an ESTree program; `value` stays empty. */
    expect(declaredConstant(tree, 'slideCount')).toBe(3)
  })

  test('frontmatter is hoisted to the root, never inside a slide', () => {
    const yaml: MdastNode = { type: 'yaml', value: 'title: Demo' }
    const tree: MdastNode = { type: 'root', children: [yaml, p('one'), break_(), p('two')] }

    run(tree)

    expect(tree.children?.map((c) => c.type)).toEqual([
      'mdxjsEsm',
      'yaml',
      'mdxJsxFlowElement',
      'mdxJsxFlowElement'
    ])
    expect(tree.children?.[2]).toEqual({
      type: 'mdxJsxFlowElement',
      name: 'Slide',
      attributes: [{ type: 'mdxJsxAttribute', name: 'index', value: '0' }],
      children: [p('one')]
    })
  })
})
