/**
 * Compiles the demo's real deck file through the real plugin pipeline. This is
 * the test that catches plugin-order regressions — frontmatter being parsed as
 * a setext heading, or the slides never being wrapped at all.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { compile } from '@mdx-js/mdx'
import { remarkDeckPlugins } from '../src/build/remark-plugins'

const source = readFileSync(new URL('../decks/example.mdx', import.meta.url), 'utf8')

const compiled = await compile(source, { remarkPlugins: remarkDeckPlugins })
const output = String(compiled.value)

describe('the demo deck', () => {
  test('has exactly three slides', () => {
    expect(output.match(/_jsxs?\(Slide,/g)).toHaveLength(3)
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
    expect(indices).toEqual(['0', '1', '2'])
  })

  test('the markdown rules between slides are gone', () => {
    expect(output).not.toContain('_components.hr')
  })
})
