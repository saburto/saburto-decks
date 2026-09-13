/**
 * The rules behind `<Appear>` and `<Move>` (R16): where an object rests when a
 * step has not reached it, where it settles when it has, and what it looks
 * like in the moment before the library that animates it arrives.
 *
 * The animation itself needs a browser, and is covered end to end.
 */
import { describe, expect, test } from 'bun:test'
import { effectiveTransition, motionStyle, resting } from '../src/runtime/Motion'

describe('resting', () => {
  test('names only what the object names, at its resting value', () => {
    expect(resting({ opacity: 0, y: 8 })).toEqual({ opacity: 1, y: 0 })
  })

  test('an object of no properties rests nowhere', () => {
    expect(resting({})).toEqual({})
  })

  test('leaves out a property the object never named, so no transform is written', () => {
    expect(resting({ opacity: 0 })).toEqual({ opacity: 1 })
  })
})

describe('motionStyle', () => {
  test('writes opacity and one transform, in Motion’s own order', () => {
    expect(motionStyle({ opacity: 0, y: 8, x: -40, scale: 0.8, rotate: 10 })).toEqual({
      opacity: 0,
      transform: 'translateX(-40px) translateY(8px) scale(0.8) rotate(10deg)'
    })
  })

  test('writes nothing for an object that names nothing', () => {
    expect(motionStyle({})).toEqual({})
  })
})

describe('effectiveTransition', () => {
  test('uses the deck’s own timing when the author names none', () => {
    expect(effectiveTransition(true, false, undefined)).toEqual({ duration: 0.25, ease: 'easeOut' })
  })

  test('uses the author’s timing when there is one', () => {
    expect(effectiveTransition(true, false, { duration: 1 })).toEqual({ duration: 1 })
  })

  test('moves nothing for a reader who prefers reduced motion (N1)', () => {
    expect(effectiveTransition(true, true, { duration: 1 })).toEqual({ duration: 0 })
  })

  test('moves nothing on a slide that is not on screen', () => {
    expect(effectiveTransition(false, false, { duration: 1 })).toEqual({ duration: 0 })
  })
})
