/**
 * The rule behind `<Mark at={…}>`: which step an annotation shows on, and so
 * how many steps it gives its slide (R12, R15). The drawing itself needs a
 * browser, and is covered end to end.
 */
import { describe, expect, test } from 'bun:test'
import { annotationStep } from '../src/runtime/Mark'

describe('annotationStep', () => {
  test('defaults to the slide showing it: step 1', () => {
    expect(annotationStep(undefined)).toBe(1)
  })

  test('counts from one, as a step does', () => {
    expect(annotationStep(1)).toBe(1)
    expect(annotationStep(2)).toBe(2)
    expect(annotationStep(7)).toBe(7)
  })

  test('accepts what JSX gives it, number or string', () => {
    expect(annotationStep('3')).toBe(3)
  })

  test('rounds a fractional step to the nearest whole one', () => {
    expect(annotationStep(2.4)).toBe(2)
    expect(annotationStep(2.6)).toBe(3)
  })

  test('never lets a step before the first one exist', () => {
    expect(annotationStep(0)).toBe(1)
    expect(annotationStep(-4)).toBe(1)
  })

  test('treats an unreadable step as "with the slide" rather than guessing', () => {
    expect(annotationStep('')).toBe(1)
    expect(annotationStep('later')).toBe(1)
    expect(annotationStep(Number.NaN)).toBe(1)
    expect(annotationStep(Number.POSITIVE_INFINITY)).toBe(1)
  })
})
