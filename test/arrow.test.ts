/**
 * The arithmetic and the drawing behind a hand-drawn arrow (R19).
 *
 * `arrow-geometry.ts` is free of the DOM and of Rough.js, so the endpoints, the
 * anchors, the bow and the head can be asserted directly. `rough-arrow.ts`
 * draws with Rough.js' generator, which also needs no browser, so the drawing
 * itself can be checked here rather than only from a page.
 */
import { describe, expect, test } from 'bun:test'
import {
  anchorPoint,
  arcGeometry,
  closestEdgePoint,
  dashPattern,
  drawLength,
  headLengthFor,
  headTransform,
  parseArrowEndpoint,
  parseArrowLength,
  parseArrowPoint,
  pathBounds,
  splitPathDefinition
} from '../src/runtime/arrow-geometry'
import { drawArrow } from '../src/runtime/rough-arrow'

describe('parseArrowLength', () => {
  test('reads a percentage, a pixel length, and a bare number as pixels', () => {
    expect(parseArrowLength('40%')).toEqual({ value: 40, unit: '%' })
    expect(parseArrowLength('12px')).toEqual({ value: 12, unit: 'px' })
    expect(parseArrowLength('-3.5')).toEqual({ value: -3.5, unit: 'px' })
    expect(parseArrowLength('40 degrees')).toBeUndefined()
    expect(parseArrowLength('')).toBeUndefined()
  })
})

describe('parseArrowPoint', () => {
  test('reads a point in the slide’s own box', () => {
    expect(parseArrowPoint('(10%, 80px)')).toEqual({
      x: { value: 10, unit: '%' },
      y: { value: 80, unit: 'px' }
    })
  })

  test('anything that is not a pair in parentheses is not a point', () => {
    expect(parseArrowPoint('10%, 80%')).toBeUndefined()
    expect(parseArrowPoint('(10% 80%)')).toBeUndefined()
    expect(parseArrowPoint('[data-id=a]')).toBeUndefined()
  })
})

describe('parseArrowEndpoint', () => {
  test('a pair of lengths is a point on the slide', () => {
    expect(parseArrowEndpoint('(0, 100%)')).toEqual({
      kind: 'point',
      x: { value: 0, unit: 'px' },
      y: { value: 100, unit: '%' }
    })
  })

  test('an element is a selector, with an anchor or without', () => {
    expect(parseArrowEndpoint('[data-id=note]@left')).toEqual({
      kind: 'element',
      query: '[data-id=note]',
      anchor: 'left'
    })
    expect(parseArrowEndpoint('  #callout  ')).toEqual({
      kind: 'element',
      query: '#callout',
      anchor: null
    })
  })

  test('an anchor must be a side or corner that exists', () => {
    expect(parseArrowEndpoint('[data-id=note]@sideways')).toBeUndefined()
    expect(parseArrowEndpoint('@left')).toBeUndefined()
    expect(parseArrowEndpoint('')).toBeUndefined()
  })
})

describe('closestEdgePoint', () => {
  const box = { x: 0, y: 0, width: 100, height: 50 }

  test('leaves the box on the side the other point lies towards', () => {
    expect(closestEdgePoint(box, { x: 200, y: 25 })).toEqual({ x: 100, y: 25 })
    expect(closestEdgePoint(box, { x: 50, y: -80 })).toEqual({ x: 50, y: 0 })
  })

  test('a point at the centre has no direction to leave in', () => {
    expect(closestEdgePoint(box, { x: 50, y: 25 })).toEqual({ x: 50, y: 25 })
  })

  test('a box with no width or height lands on its own line', () => {
    expect(closestEdgePoint({ x: 10, y: 0, width: 0, height: 50 }, { x: 10, y: 25 })).toEqual({
      x: 10,
      y: 25
    })
    expect(closestEdgePoint({ x: 10, y: 0, width: 0, height: 50 }, { x: 40, y: 90 })).toEqual({
      x: 10,
      y: 50
    })
    expect(closestEdgePoint({ x: 0, y: 0, width: 40, height: 0 }, { x: 90, y: 0 })).toEqual({
      x: 40,
      y: 0
    })
  })
})

describe('anchorPoint', () => {
  const box = { x: 10, y: 20, width: 100, height: 60 }

  test('names a side or a corner of the box', () => {
    expect(anchorPoint(box, 'center', { x: 0, y: 0 })).toEqual({ x: 60, y: 50 })
    expect(anchorPoint(box, 'top', { x: 0, y: 0 })).toEqual({ x: 60, y: 20 })
    expect(anchorPoint(box, 'bottom', { x: 0, y: 0 })).toEqual({ x: 60, y: 80 })
    expect(anchorPoint(box, 'left', { x: 0, y: 0 })).toEqual({ x: 10, y: 50 })
    expect(anchorPoint(box, 'right', { x: 0, y: 0 })).toEqual({ x: 110, y: 50 })
    expect(anchorPoint(box, 'topleft', { x: 0, y: 0 })).toEqual({ x: 10, y: 20 })
    expect(anchorPoint(box, 'topright', { x: 0, y: 0 })).toEqual({ x: 110, y: 20 })
    expect(anchorPoint(box, 'bottomleft', { x: 0, y: 0 })).toEqual({ x: 10, y: 80 })
    expect(anchorPoint(box, 'bottomright', { x: 0, y: 0 })).toEqual({ x: 110, y: 80 })
  })

  test('without an anchor it meets the edge nearest the other end', () => {
    expect(anchorPoint(box, null, { x: 500, y: 50 })).toEqual({ x: 110, y: 50 })
  })
})

describe('dashPattern', () => {
  test('a solid line has no dash, and a dashed one scales with the width', () => {
    expect(dashPattern('solid', 2)).toBeUndefined()
    expect(dashPattern('dashed', 3)).toEqual([12, 9])
  })

  test('a dotted line is a zero-length dash, left for a round cap to show', () => {
    expect(dashPattern('dotted', 4)).toEqual([0, 10])
  })
})

describe('headLengthFor', () => {
  test('grows with the line, and is 30 at a length of 200', () => {
    expect(headLengthFor(200)).toBeCloseTo(30, 6)
    expect(headLengthFor(400)).toBeGreaterThan(headLengthFor(200))
  })

  test('a named size wins, and a line too short to head has none', () => {
    expect(headLengthFor(200, 40)).toBe(40)
    expect(headLengthFor(0.5)).toBe(0)
  })
})

describe('arcGeometry', () => {
  test('coincident ends have no line between them', () => {
    expect(arcGeometry({ x: 5, y: 5 }, { x: 5, y: 5 }, 0)).toBeNull()
    expect(arcGeometry({ x: 5, y: 5 }, { x: 5, y: 5 }, 0.5)).toBeNull()
  })

  test('an arc of zero is the straight line, both heads along it', () => {
    const line = arcGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, 0)!
    expect(line.d).toBe('M0 0 L100 0')
    expect(line.length).toBe(100)
    expect(line.angle1).toBe(line.angle2)
    /* The head points along +x once the drawing turns it. */
    expect(headTransform({ x: 100, y: 0 }, line.angle2, 0)).toBe('translate(100,0) rotate(0)')
    /* The head at the other end points back the way the line came. */
    expect(headTransform({ x: 0, y: 0 }, line.angle1, 0, true)).toBe('translate(0,0) rotate(-180)')
  })

  test('a positive arc bows clockwise and a negative one anticlockwise', () => {
    const clockwise = arcGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.5)!
    const anticlockwise = arcGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, -0.5)!
    expect(clockwise.d).toContain(' A')
    expect(clockwise.d).toContain(' 0 0 1 100 0')
    expect(anticlockwise.d).toContain(' 0 0 0 100 0')
    /* The bow is longer than the chord it spans, and the two turn opposite. */
    expect(clockwise.length).toBeGreaterThan(100)
    expect(clockwise.length).toBeCloseTo(anticlockwise.length, 6)
    expect(Math.sign(clockwise.angle2 - clockwise.angle1)).toBeGreaterThan(0)
  })
})

describe('splitPathDefinition', () => {
  test('a run of subpaths becomes one definition each', () => {
    expect(splitPathDefinition('M0 0 C1 1 2 2 3 3 M4 4 C5 5 6 6 7 7')).toEqual([
      'M0 0 C1 1 2 2 3 3',
      'M4 4 C5 5 6 6 7 7'
    ])
  })
})

describe('pathBounds', () => {
  test('bounds every control point, across the definitions given', () => {
    expect(pathBounds(['M0 0 C10 10 20 -10 30 0', 'M5 5 C6 6 7 7 8 8'])).toEqual({
      x: 0,
      y: -10,
      width: 30,
      height: 20
    })
  })

  test('nothing to bound is no box', () => {
    expect(pathBounds([])).toBeNull()
    expect(pathBounds(['nonsense'])).toBeNull()
  })
})

describe('drawLength', () => {
  test('reaches a little past the line, so a rough path never stops short', () => {
    expect(drawLength(100)).toBeGreaterThan(100)
  })
})

describe('drawArrow', () => {
  const style = { width: 2, headType: 'line' as const, seed: 1, twoWay: false, arc: 0 }

  test('coincident ends draw nothing', () => {
    expect(drawArrow({ x: 1, y: 1 }, { x: 1, y: 1 }, style)).toBeNull()
  })

  test('draws a line and one head, and bounds the line', () => {
    const drawing = drawArrow({ x: 0, y: 0 }, { x: 300, y: 120 }, style)!
    expect(drawing.line.length).toBeGreaterThan(0)
    expect(drawing.line.every((path) => path.d.startsWith('M'))).toBe(true)
    expect(drawing.heads).toHaveLength(1)
    expect(drawing.heads[0]!.paths.length).toBeGreaterThan(0)
    expect(drawing.heads[0]!.paths.every((path) => path.filled === false)).toBe(true)
    expect(drawing.lineLength).toBeCloseTo(Math.hypot(300, 120), 6)
    expect(drawing.headLength).toBe(headLengthFor(drawing.lineLength))
    expect(drawing.bounds).not.toBeNull()
  })

  test('a two-way arrow carries a head at each end, facing opposite ways', () => {
    const drawing = drawArrow({ x: 0, y: 0 }, { x: 300, y: 120 }, { ...style, twoWay: true })!
    expect(drawing.heads).toHaveLength(2)
    const rotation = (transform: string) => Number(transform.match(/rotate\(([-\d.]+)\)/)![1])
    const apart = Math.abs(
      Math.abs(rotation(drawing.heads[0]!.transform) - rotation(drawing.heads[1]!.transform)) - 180
    )
    expect(apart).toBeLessThan(1e-6)
  })

  test('a polygon head is a filled shape', () => {
    const drawing = drawArrow(
      { x: 0, y: 0 },
      { x: 300, y: 120 },
      { ...style, headType: 'polygon' }
    )!
    expect(drawing.heads[0]!.paths.some((path) => path.filled)).toBe(true)
  })

  test('the same seed draws the same arrow, so resizing does not make it dance', () => {
    const once = drawArrow({ x: 0, y: 0 }, { x: 300, y: 120 }, style)!
    const twice = drawArrow({ x: 0, y: 0 }, { x: 300, y: 120 }, style)!
    expect(twice).toEqual(once)
  })
})
