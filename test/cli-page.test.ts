/**
 * The page the command serves (R23).
 *
 * The page is two strings, and this is what they must say: the HTML that loads
 * the deck's entry and starts in the right theme, and the entry that renders
 * the deck the way a host renders it — in the whole window, remembering where
 * the reader was. How they behave in a browser is covered end to end.
 */
import { describe, expect, test } from 'bun:test'
import { ENTRY_MODULE, pageHtml, pageSource, THEME_KEY } from '../src/cli/page'

const page = { name: 'demo.mdx', deckModule: '/demo.mdx', theme: 'light' as const }

describe('pageHtml', () => {
  test("loads the page's entry module", () => {
    expect(pageHtml(page)).toContain(`<script type="module" src="${ENTRY_MODULE}">`)
  })

  test('names the page after the deck file, until the deck names itself', () => {
    expect(pageHtml(page)).toContain('<title>demo.mdx</title>')
  })

  test('escapes a file name that is also markup', () => {
    const html = pageHtml({ ...page, name: '<script>alert(1)</script>.mdx' })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  test('starts in the theme it was asked for', () => {
    expect(pageHtml({ ...page, theme: 'dark' })).toContain('data-theme="dark"')
  })

  test("remembers the reader's theme before the first paint", () => {
    expect(pageHtml(page)).toContain(THEME_KEY)
  })

  test('keeps the page to the deck: no scrolling, and a switch in the corner', () => {
    const html = pageHtml(page)
    expect(html).toContain('overflow: hidden')
    expect(html).toContain('.themes {')
  })
})

describe('pageSource', () => {
  test('imports the deck file, and the component a host would use', () => {
    const source = pageSource(page)
    expect(source).toContain('import DeckFile, { frontmatter } from "/demo.mdx"')
    expect(source).toContain("import { Deck } from '@saburto/saburto-decks'")
  })

  test("quotes the deck's specifier as a string, so a query cannot break out", () => {
    expect(pageSource({ ...page, deckModule: '/a.json?x' })).toContain('from "/a.json?x"')
  })

  test("renders the deck in the whole window, with the deck's own controls", () => {
    const source = pageSource(page)
    expect(source).toContain('id="deck"')
    expect(source).toContain("height: '100dvh'")
    expect(source).toContain("width: '100%'")
    expect(source).not.toContain('controls={false}')
  })

  test('gives the deck the keyboard on arrival', () => {
    expect(pageSource(page)).toContain("document.getElementById('deck')?.focus()")
  })

  test('follows the theme switch: the page and the deck are told together', () => {
    const source = pageSource(page)
    expect(source).toContain('theme={theme}')
    expect(source).toContain("document.documentElement.setAttribute('data-theme', theme)")
    expect(source).toContain('localStorage.setItem(THEME_KEY, next)')
  })

  test("keeps the reader's slide in the URL, and starts from it", () => {
    const source = pageSource(page)
    expect(source).toContain('defaultSlide={startSlide()}')
    expect(source).toContain("'#slide=' + (index + 1)")
    expect(source).toContain('/^#slide=(\\d+)$/')
  })

  test("takes its title from the deck's frontmatter", () => {
    expect(pageSource(page)).toContain('document.title = frontmatter.title')
  })
})
