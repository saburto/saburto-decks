/**
 * A deck's own palette (R20): the stylesheet a palette stands for, and the
 * transform that gives a deck which declares one the element that applies it.
 *
 * The stylesheet is a pure function of the palette, so it is tested as one; the
 * transform is tested through the real pipeline, on a deck that has a palette
 * and on one that has not, because what matters is where the element lands —
 * with the deck, before its slides — and that the palette never becomes slide
 * content.
 */
import { describe, expect, test } from 'bun:test'
import { compile } from '@mdx-js/mdx'
import { remarkDeckPlugins } from '../src/build/remark-plugins'
import { rehypeDeckPlugins } from '../src/build/rehype-plugins'
import {
  declaredPalette,
  paletteCss,
  paletteStyle,
  usableColour,
  type DeckPalette
} from '../src/build/remark-palette'
import type { MdastNode } from '../src/build/ast'

/** A deck file, compiled the way a host's build compiles one. */
const compileDeck = async (source: string) =>
  String(
    (
      await compile(
        { value: source, path: '/tmp/palette.mdx' },
        { remarkPlugins: remarkDeckPlugins, rehypePlugins: rehypeDeckPlugins }
      )
    ).value
  )

const themed = `---
title: Two Sets
palette:
  light:
    bg: "#ffffff"
    accent: "#ff9f2b"
  dark:
    bg: "#17181a"
---

# One slide
`

describe('a palette in a deck file', () => {
  test('is applied to the deck itself, before its slides (R20)', async () => {
    const output = await compileDeck(themed)

    /* The element comes before the first slide, so it is the deck's own and
       not something the first slide carries. */
    expect(output.indexOf('_jsx(_components.style')).toBeGreaterThan(-1)
    expect(output.indexOf('_jsx(_components.style')).toBeLessThan(output.indexOf('_jsx(Slide,'))

    expect(output).toContain('--sd-bg: #ffffff;')
    expect(output).toContain('--sd-accent: #ff9f2b;')
    expect(output).toContain('--sd-bg: #17181a;')
  })

  test('is applied rather than printed: the slide carries none of it', async () => {
    const output = await compileDeck(themed)
    const slide = output.slice(output.indexOf('_jsx(Slide,'))

    expect(slide).toContain('One slide')
    expect(slide).not.toContain('palette')
    expect(slide).not.toContain('--sd-')
  })

  test('is not written into the deck when the deck declares none', async () => {
    const output = await compileDeck('# One slide\n')

    expect(output).not.toContain('_components.style')
    expect(output).not.toContain('--sd-')
  })

  test('is not written into the deck when the palette names no known colour', async () => {
    const output = await compileDeck(
      '---\npalette:\n  light:\n    sparkle: gold\n---\n\n# One slide\n'
    )

    expect(output).not.toContain('_components.style')
  })

  test('a colour that could leave its declaration is left out (R20)', async () => {
    const output = await compileDeck(
      '---\npalette:\n  light:\n    bg: "red; --sd-fg: blue"\n    accent: "#ff9f2b"\n---\n\n# One slide\n'
    )
    const style = output.slice(
      output.indexOf('_jsx(_components.style'),
      output.indexOf('_jsx(Slide,')
    )

    expect(style).toContain('--sd-accent: #ff9f2b;')
    expect(style).not.toContain('red;')
    expect(style).not.toContain('--sd-fg')
  })

  test('a deck with no frontmatter at all declares no palette', () => {
    expect(declaredPalette({ type: 'root', children: [{ type: 'paragraph' }] })).toBeUndefined()
  })
})

describe('the stylesheet a palette stands for', () => {
  test('is one :host rule per set, the light set first', () => {
    const css = paletteCss({ light: { bg: '#ffffff' }, dark: { bg: '#17181a' } })

    expect(css).toBe(
      '/* The palette this deck declares (R20). */\n' +
        ':host {\n' +
        '  --sd-bg: #ffffff;\n' +
        '}\n' +
        ":host([data-theme='dark']) {\n" +
        '  --sd-bg: #17181a;\n' +
        '}\n' +
        '@media (prefers-color-scheme: dark) {\n' +
        "  :host([data-theme='system']) {\n" +
        '    --sd-bg: #17181a;\n' +
        '  }\n' +
        '}\n'
    )
  })

  test('the dark set follows the host’s choice of theme, not the reader’s alone', () => {
    const css = paletteCss({ dark: { fg: '#c6c6c2' } })

    /* A deck that declares only a dark set adds nothing to a light page: the
       light rules are the deck's own, and the palette does not guess. */
    expect(css).toContain(":host([data-theme='dark']) {")
    expect(css).toContain('prefers-color-scheme: dark')
    expect(css).not.toContain('\n:host {')
  })

  test('names the deck’s own variables, and only those', () => {
    const css = paletteCss({
      light: { bg: '#fff', fg: '#111', muted: '#666', border: '#eee', accent: '#f90' },
      dark: { surface: '#222', highlight: 'rgb(255 0 0 / 30%)' }
    })

    for (const variable of ['--sd-bg', '--sd-fg', '--sd-muted', '--sd-border', '--sd-accent']) {
      expect(css).toContain(`${variable}:`)
    }
    expect(css).toContain('--sd-surface: #222;')
    expect(css).toContain('--sd-highlight: rgb(255 0 0 / 30%);')
    expect(css).not.toContain('--sd-aspect')
    expect(css).not.toContain('--sd-code-dim')
  })

  test('is nothing at all when it names no colour', () => {
    expect(paletteCss({})).toBe('')
    expect(paletteCss({ light: {} })).toBe('')
    /* YAML can hold anything, so a key the deck's own variables never answer to
       is simply not written. */
    expect(paletteCss({ light: { unknown: 'gold' } } as DeckPalette)).toBe('')
  })

  test('accepts a colour written any way CSS writes one', () => {
    /* The question is "can this leave the declaration it is in?", not "is this
       a colour?": a palette may hold a variable, a modern function, anything. */
    for (const colour of [
      '#ff9f2b',
      'rgb(255 159 43 / 80%)',
      'oklch(0.75 0.16 65)',
      'var(--duarte-amber)',
      'color-mix(in srgb, gold 40%, white)',
      'transparent'
    ]) {
      expect(usableColour(colour)).toBe(colour)
      expect(paletteCss({ light: { accent: colour } })).toContain(`--sd-accent: ${colour};`)
    }
  })

  test('refuses a value that could end the declaration, the block or the element', () => {
    for (const value of [
      'red;',
      'red; --sd-fg: blue',
      'red} :host { --sd-fg: blue',
      '</style><script>alert(1)</script>',
      '/* a comment */ red',
      '',
      '   '
    ]) {
      expect(usableColour(value)).toBeUndefined()
    }
    expect(usableColour(3)).toBeUndefined()
    expect(usableColour(undefined)).toBeUndefined()
  })
})

describe('the element a palette is applied with', () => {
  test('is a style element carrying the stylesheet', () => {
    const node = paletteStyle({ light: { bg: '#ffffff' } })

    expect(node.type).toBe('mdxJsxFlowElement')
    expect(node.name).toBe('style')
    expect(JSON.stringify(node)).toContain('--sd-bg: #ffffff;')
  })

  test('is a raw element: a deck needs no component of its own for it', () => {
    const node = paletteStyle({ light: { bg: '#ffffff' } }) as MdastNode

    expect(node.attributes).toEqual([])
  })
})
