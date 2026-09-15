/**
 * The contents overlay (R17), rendered and asserted on as a unit.
 *
 * The panel is presentational: the entries come from the deck's context and
 * opening, dismissing and moving focus are the caller's. Given a context of
 * its own, it can therefore be checked here without a deck, and what its
 * controls do is covered end to end.
 */
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ContentsDialog } from '../src/runtime/deck/ContentsDialog'
import { SlideContext } from '../src/runtime/Slide'

const noop = () => {}

const dialog = (index: number, titles: string[] = ['First', 'Second', 'Third']) =>
  renderToStaticMarkup(
    <SlideContext.Provider
      value={{
        index,
        count: titles.length,
        step: 0,
        theme: 'light',
        refresh: noop,
        measure: null,
        titles,
        goTo: noop
      }}
    >
      <ContentsDialog onClose={noop} />
    </SlideContext.Provider>
  )

describe('the contents overlay', () => {
  test('is a modal dialog, named for what it is (R17)', () => {
    const html = dialog(0)
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('aria-label="Table of contents"')
  })

  test('has a heading the list belongs to, and a close control (N1)', () => {
    const html = dialog(0)
    expect(html).toContain('id="sd-contents-heading"')
    expect(html).toContain('aria-labelledby="sd-contents-heading"')
    expect(html).toContain('aria-label="Close contents"')
  })

  test('lists one numbered entry per slide, named by the slide’s heading', () => {
    const html = dialog(0)
    expect(html.match(/data-toc-entry=""/g)).toHaveLength(3)
    expect(html).toContain('First')
    expect(html).toContain('Second')
    expect(html).toContain('Third')
    /* The numbers are decoration: the title is what the entry is called. */
    expect(html).toContain('aria-hidden="true"')
  })

  test('marks the slide the reader is on, and only that one (R17)', () => {
    expect(dialog(1).match(/aria-current="true"/g)).toHaveLength(1)
    expect(dialog(1).split('data-toc-entry=""')[2]).toContain('aria-current="true"')
  })

  test('lists a slide with no heading by its number, so the list always covers the deck', () => {
    const html = dialog(0, ['First', 'Slide 2'])
    expect(html).toContain('Slide 2')
    expect(html.match(/data-toc-entry=""/g)).toHaveLength(2)
  })
})
