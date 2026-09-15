/**
 * The AST vocabulary the deck's build plugins share.
 *
 * These are the pieces every plugin reaches for — reading an element's
 * attributes, walking the tree, and building the nodes a rewrite inserts — so
 * they are tested once here, against plain objects, rather than through any
 * one plugin.
 */
import { describe, expect, test } from 'bun:test'
import {
  attribute,
  esmDefaultImport,
  estreeProgram,
  expressionAttribute,
  jsxAttribute,
  jsxElement,
  stringAttribute,
  textNode,
  walk,
  type MdastNode
} from '../src/build/ast'

const element = (attributes: MdastNode[] = []): MdastNode => ({
  type: 'mdxJsxFlowElement',
  name: 'Slides',
  attributes
})

describe('attributes', () => {
  test('finds an attribute by name, and nothing when there is none', () => {
    const node = element([jsxAttribute('src', './part.mdx'), jsxAttribute('offset', '2')])
    expect(attribute(node, 'src')?.value).toBe('./part.mdx')
    expect(attribute(node, 'other')).toBeUndefined()
    expect(attribute({ type: 'paragraph' }, 'src')).toBeUndefined()
  })

  test('reads an attribute written as a string', () => {
    expect(stringAttribute(element([jsxAttribute('src', './part.mdx')]), 'src')).toBe('./part.mdx')
  })

  test('a value that is an expression is not a string, and is not read as one', () => {
    expect(stringAttribute(element([expressionAttribute('src', 'binding')]), 'src')).toBeUndefined()
  })
})

describe('walk', () => {
  const tree: MdastNode = {
    type: 'root',
    children: [
      { type: 'paragraph', children: [{ type: 'text', value: 'a' }] },
      { type: 'blockquote', children: [{ type: 'paragraph', children: [{ type: 'text', value: 'b' }] }] }
    ]
  }

  test('visits every node, the root included, whatever their depth', () => {
    const seen: string[] = []
    walk(tree, (node) => seen.push(node.type))
    expect(seen).toEqual(['root', 'paragraph', 'text', 'blockquote', 'paragraph', 'text'])
  })

  test('a leaf is visited and left alone', () => {
    const seen: string[] = []
    walk({ type: 'text', value: 'a' }, (node) => seen.push(node.type))
    expect(seen).toEqual(['text'])
  })

  test('may rewrite the tree as it goes, and keeps traversing it', () => {
    const replaced: MdastNode = {
      type: 'root',
      children: [{ type: 'code', lang: 'mermaid' }, { type: 'paragraph' }]
    }
    const seen: string[] = []
    walk(replaced, (node) => {
      seen.push(node.type)
      if (node.type === 'code') replaced.children = [jsxElement('Mermaid', { children: [textNode('x')] })]
    })
    expect(replaced.children?.[0]?.name).toBe('Mermaid')
    expect(seen).toEqual(['root', 'code', 'paragraph'])
  })
})

describe('building nodes', () => {
  test('an MDX element is a flow element with the attributes and children given', () => {
    expect(jsxElement('Mermaid', { children: [textNode('x')] })).toEqual({
      type: 'mdxJsxFlowElement',
      name: 'Mermaid',
      attributes: [],
      children: [{ type: 'text', value: 'x' }]
    })
  })

  test('an element can be built as another MDX kind', () => {
    expect(jsxElement('Mark', { type: 'mdxJsxTextElement' }).type).toBe('mdxJsxTextElement')
  })

  test('an expression attribute carries the program MDX needs beside it', () => {
    const built = expressionAttribute('src', '__slides')
    expect(built.name).toBe('src')
    expect(built.value).toEqual({
      type: 'mdxJsxAttributeValueExpression',
      value: '__slides',
      data: { estree: estreeProgram({ type: 'Identifier', name: '__slides' }) }
    })
  })

  test('a default import carries both its text and the tree it stands for', () => {
    const built = esmDefaultImport('__slides', './part.mdx')
    expect(built.type).toBe('mdxjsEsm')
    expect(built.value).toBe('import __slides from "./part.mdx"')
    expect(built.data?.['estree']).toEqual({
      type: 'Program',
      sourceType: 'module',
      body: [
        {
          type: 'ImportDeclaration',
          specifiers: [{ type: 'ImportDefaultSpecifier', local: { type: 'Identifier', name: '__slides' } }],
          source: { type: 'Literal', value: './part.mdx', raw: '"./part.mdx"' }
        }
      ]
    })
  })
})
