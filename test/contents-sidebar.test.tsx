/**
 * The contents sidebar (R17, R22), rendered and asserted on as a unit.
 *
 * The panel is presentational: the entries come from the deck's context and
 * opening, dismissing and moving focus are the caller's. Given a context of
 * its own, it can therefore be checked here without a deck, and what its
 * controls do is covered end to end.
 */
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ContentsSidebar } from '../src/runtime/deck/ContentsSidebar'
import { SlideContext } from '../src/runtime/Slide'
import type { ContentsSlide } from '../src/runtime/contents'

const noop = () => {}

const OUTLINE: ContentsSlide[] = [
  { title: 'First', sections: [] },
  { title: 'Second', sections: ['Why', 'How'] },
  { title: 'Slide 3', sections: [] }
]

const sidebar = (index: number, outline: ContentsSlide[] = OUTLINE) =>
  renderToStaticMarkup(
    <SlideContext.Provider
      value={{
        index,
        count: outline.length,
        step: 0,
        theme: 'light',
        refresh: noop,
        measure: null,
        outline,
        goTo: noop
      }}
    >
      <ContentsSidebar onClose={noop} />
    </SlideContext.Provider>
  )

describe('the contents sidebar', () => {
  test('is a dialog, named for what it is (R17)', () => {
    const html = sidebar(0)
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-label="Table of contents"')
  })

  test('has a heading the list belongs to, and a close control (N1)', () => {
    const html = sidebar(0)
    expect(html).toContain('id="sd-contents-heading"')
    expect(html).toContain('aria-labelledby="sd-contents-heading"')
    expect(html).toContain('aria-label="Close contents"')
  })

  test('lists one numbered entry per slide, named by the slide’s heading', () => {
    const html = sidebar(0)
    expect(html.match(/data-toc-slide="/g)).toHaveLength(3)
    expect(html).toContain('First')
    expect(html).toContain('Second')
    expect(html).toContain('Slide 3')
    /* The numbers are decoration: the title is what the entry is called. */
    expect(html).toContain('aria-hidden="true"')
  })

  test('lists the slide’s own second-level headings under it (R17)', () => {
    const html = sidebar(0)
    expect(html.match(/data-toc-section=""/g)).toHaveLength(2)
    /* Under the slide they belong to, not floating at the end of the list. */
    expect(html.indexOf('Why')).toBeGreaterThan(html.indexOf('Second'))
    expect(html.indexOf('How')).toBeGreaterThan(html.indexOf('Why'))
  })

  test('marks the slide the reader is on, and only that one (R17)', () => {
    expect(sidebar(1).match(/aria-current="true"/g)).toHaveLength(1)
    expect(sidebar(1).split('data-toc-slide="')[2]).toContain('aria-current="true"')
  })

  test('lists a slide with no heading by its number, so the list always covers the deck', () => {
    const html = sidebar(0, [{ title: 'Slide 1', sections: [] }])
    expect(html).toContain('Slide 1')
    expect(html.match(/data-toc-slide="/g)).toHaveLength(1)
  })
})
