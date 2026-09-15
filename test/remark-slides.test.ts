import { describe, expect, test } from 'bun:test'
import { remarkSlides, splitSlides, type MdastNode } from '../src/build/remark-slides'

const run = (tree: MdastNode) => remarkSlides()(tree)

const p = (text: string): MdastNode => ({ type: 'paragraph', children: [{ type: 'text', value: text }] })
const heading = (text: string): MdastNode => ({ type: 'heading', depth: 1, children: [{ type: 'text', value: text }] })
const break_ = (): MdastNode => ({ type: 'thematicBreak' })
const attribute = (node: MdastNode | undefined, name: string) =>
  node?.attributes?.find((candidate) => candidate.name === name)
/** An include as `remark-imports` leaves it: a file, and the slides it brings. */
const include = (src: string, slides: number): MdastNode => ({
  type: 'mdxJsxFlowElement',
  name: 'Slides',
  attributes: [{ type: 'mdxJsxAttribute', name: 'src', value: src }],
  data: { sdSlides: slides }
})

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

  test('a slide that is an include stays an element, at its place in the deck (R18)', () => {
    const slides = splitSlides([p('one'), break_(), include('./part.mdx', 3), break_(), p('five')])

    expect(slides).toHaveLength(3)
    expect(slides[1]?.name).toBe('Slides')
    expect(attribute(slides[1], 'offset')?.value).toBe('1')
    /* The slide after it is numbered for the three slides the include brings. */
    expect(attribute(slides[2], 'index')?.value).toBe('4')
  })

  test('an include inside a slide is that slide\'s content (R18)', () => {
    const slides = splitSlides([p('one'), break_(), p('two'), include('./part.mdx', 3)])

    expect(slides).toHaveLength(2)
    expect(slides[1]?.name).toBe('Slide')
    expect(attribute(slides[1], 'index')?.value).toBe('1')
    expect(slides[1]?.children?.map((node) => node.name ?? node.type)).toEqual(['paragraph', 'Slides'])
  })

  test('imports in a slide that is an include keep their place in the file (R18)', () => {
    const esm: MdastNode = { type: 'mdxjsEsm', value: "import x from './part.mdx'" }
    const slides = splitSlides([esm, include('./part.mdx', 2)])

    expect(slides.map((node) => node.name ?? node.type)).toEqual(['mdxjsEsm', 'Slides'])
  })
})

describe('remarkSlides', () => {
  test('replaces the tree children with slides', () => {
    const tree: MdastNode = { type: 'root', children: [p('one'), break_(), p('two')] }

    run(tree)

    expect(tree.children?.map((c) => c.type)).toEqual(['mdxJsxFlowElement', 'mdxJsxFlowElement'])
  })

  test('frontmatter is hoisted to the root, never inside a slide', () => {
    const yaml: MdastNode = { type: 'yaml', value: 'title: Demo' }
    const tree: MdastNode = { type: 'root', children: [yaml, p('one'), break_(), p('two')] }

    run(tree)

    expect(tree.children?.map((c) => c.type)).toEqual(['yaml', 'mdxJsxFlowElement', 'mdxJsxFlowElement'])
    expect(tree.children?.[1]).toEqual({
      type: 'mdxJsxFlowElement',
      name: 'Slide',
      attributes: [{ type: 'mdxJsxAttribute', name: 'index', value: '0' }],
      children: [p('one')]
    })
  })
})
