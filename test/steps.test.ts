/**
 * The rule behind `at` on step-driven content (R12): which step a thing that
 * counts its own steps — an annotation (R15), an object that appears or moves
 * (R16) — happens on, and therefore how many steps it gives its slide.
 */
import { describe, expect, test } from 'bun:test'
import { stepAt } from '../src/runtime/steps'

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
