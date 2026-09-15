/**
 * The rules behind the deck's steps (R12, R14, R15, R16), which are the rules
 * a reader feels but no single component owns: how many a slide has, which
 * position next and previous move to, and how a code block and a diagram show
 * one.
 *
 * The showing itself is a DOM effect and is covered end to end; what is tested
 * here is every decision it is made of, so a change to the sequence is caught
 * without a browser.
 */
import { describe, expect, test } from 'bun:test'
import {
  codeBlockState,
  countSteps,
  diagramVisibility,
  lineHighlighted,
  resolvePosition,
  stepAt,
  stepBack,
  stepForward,
  STEP_SOURCES
} from '../src/runtime/steps'

describe('stepAt', () => {
  test('defaults to the slide showing it: step 1', () => {
    expect(stepAt(undefined)).toBe(1)
  })

  test('counts from one, as a step does', () => {
    expect(stepAt(1)).toBe(1)
    expect(stepAt(2)).toBe(2)
    expect(stepAt(7)).toBe(7)
  })

  test('accepts what JSX gives it, number or string', () => {
    expect(stepAt('3')).toBe(3)
  })

  test('rounds a fractional step to the nearest whole one', () => {
    expect(stepAt(2.4)).toBe(2)
    expect(stepAt(2.6)).toBe(3)
  })

  test('never lets a step before the first one exist', () => {
    expect(stepAt(0)).toBe(1)
    expect(stepAt(-4)).toBe(1)
  })

  test('treats an unreadable step as "with the slide" rather than guessing', () => {
    expect(stepAt('')).toBe(1)
    expect(stepAt('later')).toBe(1)
    expect(stepAt(Number.NaN)).toBe(1)
    expect(stepAt(Number.POSITIVE_INFINITY)).toBe(1)
  })
})

/** A deck of four slides whose steps are 1, 3, 1 and 2. */
const stepsAt = (index: number) => [1, 3, 1, 2][index] ?? 1
const DECK = 4

describe('resolvePosition', () => {
  test('leaves a position the deck actually has alone', () => {
    expect(resolvePosition({ index: 1, step: 1 }, DECK, stepsAt)).toEqual({ index: 1, step: 1 })
  })

  test('clamps the slide to the deck', () => {
    expect(resolvePosition({ index: 9, step: 0 }, DECK, stepsAt)).toEqual({ index: 3, step: 0 })
    expect(resolvePosition({ index: -2, step: 0 }, DECK, stepsAt)).toEqual({ index: 0, step: 0 })
  })

  test('clamps the step to the slide it lands on, not to the one it left', () => {
    /* A step 3 asked for on a slide that has one step means step 0. */
    expect(resolvePosition({ index: 2, step: 2 }, DECK, stepsAt)).toEqual({ index: 2, step: 0 })
    expect(resolvePosition({ index: 1, step: 8 }, DECK, stepsAt)).toEqual({ index: 1, step: 2 })
  })

  test('a deck with no slides has one position, at the start', () => {
    expect(resolvePosition({ index: 3, step: 4 }, 0, stepsAt)).toEqual({ index: 0, step: 0 })
  })
})

describe('stepForward and stepBack', () => {
  test('advance within a slide before leaving it (R12)', () => {
    expect(stepForward({ index: 1, step: 0 }, DECK, stepsAt)).toEqual({ index: 1, step: 1 })
    expect(stepForward({ index: 1, step: 1 }, DECK, stepsAt)).toEqual({ index: 1, step: 2 })
  })

  test('leave the slide only after its last step, onto the next one’s first', () => {
    expect(stepForward({ index: 1, step: 2 }, DECK, stepsAt)).toEqual({ index: 2, step: 0 })
  })

  test('going back from a slide’s first step lands on the previous slide’s last', () => {
    expect(stepBack({ index: 2, step: 0 }, DECK, stepsAt)).toEqual({ index: 1, step: 2 })
    expect(stepBack({ index: 1, step: 0 }, DECK, stepsAt)).toEqual({ index: 0, step: 0 })
  })

  test('is a perfect reversal: back undoes forward, everywhere (R12)', () => {
    for (let index = 0; index < DECK; index++) {
      for (let step = 0; step < stepsAt(index); step++) {
        const forward = stepForward({ index, step }, DECK, stepsAt)
        /* The end of the deck has nowhere to go; everywhere else reverses. */
        if (forward.index === index && forward.step === step) continue
        expect(stepBack(forward, DECK, stepsAt)).toEqual({ index, step })
      }
    }
  })

  test('the ends of the deck hold still rather than wrapping', () => {
    expect(stepForward({ index: DECK - 1, step: 1 }, DECK, stepsAt)).toEqual({ index: 3, step: 1 })
    expect(stepBack({ index: 0, step: 0 }, DECK, stepsAt)).toEqual({ index: 0, step: 0 })
  })
})

describe('codeBlockState', () => {
  test('lights the step it is at, and dims the rest', () => {
    expect(codeBlockState(4, [], 1)).toEqual({ at: 1, hidden: false, dims: true })
  })

  test('a {hide} step takes the block off the slide, and says nothing about dimming', () => {
    expect(codeBlockState(4, [2], 2)).toEqual({ at: 2, hidden: true, dims: false })
    expect(codeBlockState(4, [2], 1)).toEqual({ at: 1, hidden: false, dims: true })
  })

  test('a step past the last one shows the last, as the build’s own state does', () => {
    expect(codeBlockState(3, [], 99).at).toBe(2)
  })
})

describe('lineHighlighted', () => {
  const state = codeBlockState(4, [], 1)

  test('lights a line whose data-hl names this step', () => {
    expect(lineHighlighted([1, 3], state)).toBe(true)
  })

  test('leaves a line this step does not name unlit', () => {
    expect(lineHighlighted([0, 2], state)).toBe(false)
  })

  test('lights nothing while the block is off the slide', () => {
    expect(lineHighlighted([1], codeBlockState(4, [1], 1))).toBe(false)
  })
})

describe('diagramVisibility', () => {
  test('reveals a diagram a step at a time, up to the current step (R14)', () => {
    expect(diagramVisibility(0, 2, false)).toEqual({ className: 'sd-shown', on: true })
    expect(diagramVisibility(2, 2, false)).toEqual({ className: 'sd-shown', on: true })
    expect(diagramVisibility(3, 2, false)).toEqual({ className: 'sd-shown', on: false })
  })

  test('a {build} diagram keeps every element and brings the current one forward', () => {
    expect(diagramVisibility(1, 1, true)).toEqual({ className: 'sd-current', on: true })
    expect(diagramVisibility(0, 1, true)).toEqual({ className: 'sd-current', on: false })
  })
})

describe('countSteps', () => {
  /* The one DOM rule here, and the smallest possible double for it: a slide
     whose `[data-steps]` elements are known. */
  const element = (steps: string | null) => ({
    getAttribute: (name: string) => (name === 'data-steps' ? steps : null)
  })
  const slide = (...elements: ReturnType<typeof element>[]) =>
    ({ querySelectorAll: () => elements }) as unknown as Element

  test('a slide with nothing that steps still has the one state it arrives in', () => {
    expect(countSteps(slide())).toBe(1)
    expect(countSteps(null)).toBe(1)
  })

  test('the most any one piece of its content has is the slide’s count', () => {
    expect(countSteps(slide(element('1'), element('5'), element('3')))).toBe(5)
  })

  test('ignores a count that is missing or unreadable', () => {
    expect(countSteps(slide(element(null), element('later'), element('2')))).toBe(2)
  })
})

describe('whose steps the deck shows', () => {
  test('code blocks and diagrams declare a source each, and nothing else does', () => {
    expect(STEP_SOURCES.map((source) => source.selector)).toEqual([
      'pre.shiki[data-steps]',
      '.sd-mermaid[data-steps]'
    ])
  })
})
