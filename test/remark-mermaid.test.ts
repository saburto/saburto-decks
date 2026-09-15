/**
 * The build transform that turns a ```mermaid fence into a `<Mermaid>` element
 * (R13, R14): the source has to survive exactly, and a `{full}` fence has to be
 * marked so the deck draws the whole diagram at once.
 */
import { describe, expect, test } from 'bun:test'
import {
  isMermaid,
  mermaidElement,
  remarkMermaid,
  wantsBuiltDiagram,
  wantsWholeDiagram
} from '../src/build/remark-mermaid'
import type { MdastNode } from '../src/build/ast'

const code = (value: string, meta = ''): MdastNode => ({ type: 'code', lang: 'mermaid', meta, value })
const paragraph = (text: string): MdastNode => ({ type: 'paragraph', children: [{ type: 'text', value: text }] })

describe('a mermaid fence', () => {
  test('is recognised, and other code fences are not', () => {
    expect(isMermaid(code('sequenceDiagram'))).toBe(true)
    expect(isMermaid({ type: 'code', lang: 'ts', value: 'a' })).toBe(false)
    expect(isMermaid(paragraph('mermaid'))).toBe(false)
  })

  test('becomes a Mermaid element carrying its source, verbatim', () => {
    const source = 'sequenceDiagram\n    Alice->>John: Hello {there}\n    John-->>Alice: <bye>'
    expect(mermaidElement(code(source))).toEqual({
      type: 'mdxJsxFlowElement',
      name: 'Mermaid',
      attributes: [],
      children: [{ type: 'text', value: source }]
    })
  })

  test('its `{full}` meta asks for the whole diagram (R14)', () => {
    expect(wantsWholeDiagram(code('flowchart LR\n A-->B', '{full}'))).toBe(true)
    expect(mermaidElement(code('x', '{full}')).attributes).toEqual([
      { type: 'mdxJsxAttribute', name: 'data-full', value: 'true' }
    ])
    expect(wantsWholeDiagram(code('x'))).toBe(false)
  })

  test('its `{build}` meta asks for the whole diagram, highlighted by step (R14)', () => {
    expect(wantsBuiltDiagram(code('flowchart LR\n A-->B', '{build}'))).toBe(true)
    expect(mermaidElement(code('x', '{build}')).attributes).toEqual([
      { type: 'mdxJsxAttribute', name: 'data-build', value: 'true' }
    ])
    expect(wantsBuiltDiagram(code('x', '{full}'))).toBe(false)
    expect(mermaidElement(code('x', '{full}')).attributes).toEqual([
      { type: 'mdxJsxAttribute', name: 'data-full', value: 'true' }
    ])
  })

  test('is replaced in place, wherever it sits', () => {
    const tree: MdastNode = {
      type: 'root',
      children: [code('sequenceDiagram'), paragraph('after')]
    }

    remarkMermaid()(tree)

    expect(tree.children?.map((child) => child.type)).toEqual(['mdxJsxFlowElement', 'paragraph'])
    expect(tree.children?.[0]?.children).toEqual([{ type: 'text', value: 'sequenceDiagram' }])
  })

  test('is found inside a block quote, not only at the top level', () => {
    const tree: MdastNode = {
      type: 'root',
      children: [{ type: 'blockquote', children: [code('sequenceDiagram')] }]
    }

    remarkMermaid()(tree)

    const quote = tree.children?.[0]
    expect(quote?.children?.[0]?.type).toBe('mdxJsxFlowElement')
    expect(quote?.children?.[0]?.name).toBe('Mermaid')
  })

  test('leaves ordinary code and prose untouched', () => {
    const block = { type: 'code', lang: 'ts', value: 'const a = 1' }
    const tree: MdastNode = { type: 'root', children: [block, paragraph('prose')] }

    remarkMermaid()(tree)

    expect(tree.children?.[0]).toEqual(block)
  })
})
