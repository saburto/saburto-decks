/**
 * The deck's control bar (R6, R12, R17), rendered and asserted on as a unit.
 *
 * The bar is presentational on purpose: every value it shows and every control
 * it offers comes in as a prop, so what it displays and what it disables can be
 * checked here, without a shadow root, a browser, or a deck around it. What the
 * buttons do belongs to the deck, and is covered end to end.
 */
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { DeckBar, type DeckBarProps } from '../src/runtime/deck/DeckBar'

const noop = () => {}

const bar = (props: Partial<DeckBarProps> = {}) =>
  renderToStaticMarkup(
    <DeckBar
      index={0}
      count={22}
      step={0}
      stepCount={1}
      mode="embedded"
      contentsOpen={false}
      onPrev={noop}
      onNext={noop}
      onToggleContents={noop}
      onTogglePresent={noop}
      {...props}
    />
  )

/** The `<button>` elements of the bar, in order. */
const buttons = (html: string) => html.match(/<button[\s\S]*?<\/button>/g) ?? []

describe('the control bar', () => {
  test('is a toolbar, so it is announced as the deck’s controls', () => {
    expect(bar()).toContain('role="toolbar"')
    expect(bar()).toContain('aria-label="Deck controls"')
  })

  test('counts the reader’s place in the deck', () => {
    expect(bar({ index: 2, count: 22 })).toContain('3 / 22')
  })

  test('shows no count before the deck knows how many slides it has', () => {
    expect(bar({ count: 0 })).toContain('class="counter min-w-[4ch]')
    expect(bar({ count: 0 })).not.toContain('/ 0')
  })

  test('goes back with nothing to go back to, and forward with nothing to move to', () => {
    const [previous, next] = buttons(bar({ index: 0, step: 0 }))
    expect(previous).toContain('disabled=""')
    expect(next).not.toContain('disabled=""')

    const [first, last] = buttons(bar({ index: 21, count: 22, step: 0, stepCount: 1 }))
    expect(first).not.toContain('disabled=""')
    expect(last).toContain('disabled=""')
  })

  test('a slide with more than one step disables next only once the last is shown (R12)', () => {
    const [, next] = buttons(bar({ index: 21, count: 22, step: 1, stepCount: 3 }))
    expect(next).not.toContain('disabled=""')
    const [, atEnd] = buttons(bar({ index: 21, count: 22, step: 2, stepCount: 3 }))
    expect(atEnd).toContain('disabled=""')
  })

  test('shows one dot per step, and marks which one the reader is on (R12)', () => {
    const html = bar({ step: 1, stepCount: 3 })
    expect(html.match(/class="step-dot /g)).toHaveLength(3)
    expect(html.match(/data-on=""/g)).toHaveLength(1)
    /* Only the current dot carries the marker. */
    expect(html.split('step-dot')[2]).toContain('data-on=""')
  })

  test('shows no dots for a slide with a single step', () => {
    expect(bar({ stepCount: 1 })).not.toContain('step-dot')
  })

  test('says whether the contents are open, and offers them as a dialog (R17)', () => {
    expect(bar({ contentsOpen: false })).toContain('aria-expanded="false"')
    expect(bar({ contentsOpen: true })).toContain('aria-expanded="true"')
    expect(bar()).toContain('aria-haspopup="dialog"')
  })

  test('offers the mode the reader is not in (R6)', () => {
    expect(bar({ mode: 'embedded' })).toContain('Full screen')
    expect(bar({ mode: 'present' })).toContain('Exit')
  })
})
