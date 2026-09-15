/**
 * The arithmetic behind a hand-drawn arrow (R19), kept free of the DOM and of
 * Rough.js so it can be reasoned about, and tested, on its own:
 *
 * - where an arrow's ends are written — a point on the slide, or an element to
 *   snap to — and where they land once measured;
 * - the line between them: straight, or bowed by an `arc`;
 * - the width of the head each end carries, and the angle it is drawn at;
 * - the dash pattern of the line;
 * - the pieces a roughened path is split into, and the box that contains them.
 *
 * `rough-arrow.ts` turns these into an actual drawing; `Arrow.tsx` measures the
 * elements and animates it. Everything here is a function of its arguments.
 */

/** A side or corner of an element an arrow may be anchored to. */
export const ARROW_ANCHORS = [
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'topleft',
  'topright',
  'bottomleft',
  'bottomright'
] as const
export type ArrowAnchor = (typeof ARROW_ANCHORS)[number]

const ANCHOR_SET: ReadonlySet<string> = new Set(ARROW_ANCHORS)

/** How the line is drawn. */
export type ArrowLineStyle = 'solid' | 'dashed' | 'dotted'

/** How the head is drawn: two strokes, or a filled triangle. */
export type ArrowHeadType = 'line' | 'polygon'

export interface ArrowPoint {
  x: number
  y: number
}

export interface ArrowBox {
  x: number
  y: number
  width: number
  height: number
}

/** A length the author wrote, resolved against the box it sits in. */
export interface ArrowLength {
  value: number
  unit: 'px' | '%'
}

/** One end of an arrow, as the author wrote it. */
export type ArrowEndpoint =
  | { kind: 'point'; x: ArrowLength; y: ArrowLength }
  | { kind: 'element'; query: string; anchor: ArrowAnchor | null }

/** One path of a drawing, and whether it is a filled shape or a stroke. */
export interface ArrowPath {
  d: string
  filled: boolean
}

export interface ArrowHead {
  /** Where the head sits and which way it points, as an SVG `transform`. */
  transform: string
  paths: ArrowPath[]
}

/** A whole arrow, ready to render (R19). */
export interface ArrowDrawing {
  line: ArrowPath[]
  heads: ArrowHead[]
  /** The length of the line, in px, used to time and reveal the drawing. */
  lineLength: number
  /** How long each head's strokes are, in px. */
  headLength: number
  /** The box containing the line, for the animation's mask. */
  bounds: ArrowBox | null
}

/** How long an arrow takes to draw itself in, in ms. The same default the
 * annotations use (R15). */
export const ARROW_DRAW_MS = 700

const LENGTH_PATTERN = /^\s*(?<value>[+-]?(?:\d+\.?\d*|\.\d+))\s*(?<unit>%|px)?\s*$/
const POINT_PATTERN = /^\(\s*(?<x>[^,()]+?)\s*,\s*(?<y>[^,()]+?)\s*\)$/

/** `"40%"`, `"12px"`, or a bare number, which is pixels. */
export function parseArrowLength(value: string): ArrowLength | undefined {
  const match = LENGTH_PATTERN.exec(value)
  if (!match?.groups) return undefined
  return { value: Number(match.groups['value']), unit: match.groups['unit'] === '%' ? '%' : 'px' }
}

/** `"(40%, 12px)"` — a point on the slide. */
export function parseArrowPoint(value: string): { x: ArrowLength; y: ArrowLength } | undefined {
  const match = POINT_PATTERN.exec(value)
  if (!match?.groups) return undefined
  const x = parseArrowLength(match.groups['x'] ?? '')
  const y = parseArrowLength(match.groups['y'] ?? '')
  return x && y ? { x, y } : undefined
}

/**
 * One end of an arrow, in the form the author wrote it:
 *
 * - a point — `"(40%, 12px)"`;
 * - an element — a CSS selector, `"[data-id=note]"`, optionally with the side
 *   or corner to anchor to, `"[data-id=note]@left"`. Without one, the arrow
 *   meets the element at the point of its edge closest to the other end.
 *
 * Anything else is `undefined`, and the arrow is not drawn.
 */
export function parseArrowEndpoint(value: string): ArrowEndpoint | undefined {
  const text = value.trim()
  if (!text) return undefined

  const point = parseArrowPoint(text)
  if (point) return { kind: 'point', ...point }

  /* The anchor, if any, is everything after an `@` (which a selector may not
     contain). A selector that is only an anchor is not an endpoint. */
  const at = text.indexOf('@')
  const query = (at === -1 ? text : text.slice(0, at)).trim()
  const anchor = at === -1 ? '' : text.slice(at + 1).trim()
  if (!query) return undefined
  if (anchor && !ANCHOR_SET.has(anchor)) return undefined

  return { kind: 'element', query, anchor: anchor ? (anchor as ArrowAnchor) : null }
}

/** The point where a ray from the box's centre towards `toward` leaves it. */
export function closestEdgePoint(box: ArrowBox, toward: ArrowPoint): ArrowPoint {
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  if (box.width === 0) {
    return { x: cx, y: Math.max(box.y, Math.min(box.y + box.height, toward.y)) }
  }
  if (box.height === 0) {
    return { x: Math.max(box.x, Math.min(box.x + box.width, toward.x)), y: cy }
  }

  const dx = toward.x - cx
  const dy = toward.y - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }

  if (Math.abs(dx / dy) > box.width / box.height) {
    const x = dx > 0 ? box.x + box.width : box.x
    /* Similar triangles: (y - cy) / dy = (x - cx) / dx. */
    return { x, y: cy + ((x - cx) * dy) / dx }
  }
  const y = dy > 0 ? box.y + box.height : box.y
  return { x: cx + ((y - cy) * dx) / dy, y }
}

/** Where on a measured element an arrow meets it: a named side or corner, or
 * the edge point nearest the other end when it names none. */
export function anchorPoint(
  box: ArrowBox,
  anchor: ArrowAnchor | null,
  toward: ArrowPoint
): ArrowPoint {
  if (anchor === null) return closestEdgePoint(box, toward)
  const x = anchor.includes('left')
    ? box.x
    : anchor.includes('right')
      ? box.x + box.width
      : box.x + box.width / 2
  const y = anchor.includes('top')
    ? box.y
    : anchor.includes('bottom')
      ? box.y + box.height
      : box.y + box.height / 2
  return { x, y }
}

/** The dash pattern of a line, scaled with its width so it reads the same at
 * any size. A dotted line is a zero-length dash, which only shows as a dot
 * with a round cap — which the drawing gives it. */
export function dashPattern(lineStyle: ArrowLineStyle, width: number): number[] | undefined {
  if (lineStyle === 'dashed') return [width * 4, width * 3]
  if (lineStyle === 'dotted') return [0, width * 2.5]
  return undefined
}

/** How long the head at each end is. It grows with the line, so a long arrow
 * does not look like a pin, and is 30 at a length of 200. */
export function headLengthFor(lineLength: number, headSize?: number): number {
  if (headSize !== undefined && Number.isFinite(headSize)) return Math.max(0, headSize)
  if (!(lineLength > 1)) return 0
  return (30 * Math.log(lineLength)) / Math.log(200)
}

/**
 * The line an arrow is drawn along, as an SVG path definition and the angles
 * its heads sit at.
 *
 * A straight line is the `arc` of zero: its two angles are the direction of
 * the line itself. Any other `arc` bows the line around a centre placed off
 * the chord — a positive one clockwise, a negative one anticlockwise — and
 * each head follows the tangent at its own end.
 */
export interface ArrowArc {
  d: string
  angle1: number
  angle2: number
  length: number
  mid: ArrowPoint
}

export function arcGeometry(point1: ArrowPoint, point2: ArrowPoint, arc: number): ArrowArc | null {
  if (point1.x === point2.x && point1.y === point2.y) return null

  if (arc === 0) {
    const angle = Math.atan2(point2.y - point1.y, point2.x - point1.x) - Math.PI / 2
    return {
      d: `M${point1.x} ${point1.y} L${point2.x} ${point2.y}`,
      angle1: angle,
      angle2: angle,
      length: Math.hypot(point2.x - point1.x, point2.y - point1.y),
      mid: { x: (point1.x + point2.x) / 2, y: (point1.y + point2.y) / 2 }
    }
  }

  const mid = { x: (point1.x + point2.x) / 2, y: (point1.y + point2.y) / 2 }
  const dx = point2.x - point1.x
  const dy = point2.y - point1.y
  const chord = Math.hypot(dx, dy)
  /* The unit vector perpendicular to the chord. */
  const normal = { x: -dy / chord, y: dx / chord }

  /* How far the arc's centre sits from the midpoint of the chord. At |arc| = 1
     the centre is the midpoint; a smaller value pushes it further away, for a
     flatter curve. Derived from R = offset + arc * chord / 2 and Pythagoras. */
  const offset = ((1 - arc * arc) * chord) / (4 * arc)
  const center = { x: mid.x + offset * normal.x, y: mid.y + offset * normal.y }
  const radius = Math.sqrt((chord / 2) ** 2 + offset ** 2)

  const angle1 = Math.atan2(point1.y - center.y, point1.x - center.x)
  const angle2 = Math.atan2(point2.y - center.y, point2.x - center.x)
  let start = arc > 0 ? angle1 : angle2
  let end = arc > 0 ? angle2 : angle1
  if (end < start) end += 2 * Math.PI

  const largeArc = arc < -1 || arc > 1 ? 1 : 0
  const sweep = arc > 0 ? 1 : 0
  const signedRadius = radius * Math.sign(offset)

  return {
    d: `M${point1.x} ${point1.y} A${radius} ${radius} 0 ${largeArc} ${sweep} ${point2.x} ${point2.y}`,
    angle1,
    angle2,
    length: radius * (end - start),
    mid: { x: center.x - signedRadius * normal.x, y: center.y - signedRadius * normal.y }
  }
}

/** Where a head sits and which way it points, as an SVG `transform`.
 *
 * A head is drawn with its point at the origin and its tail back along −x, so
 * a rotation alone aims it. An arc turns the head by a quarter turn from the
 * radius to its own tangent; `reverse` turns the other way, which is what the
 * head at the far end of a two-way arrow carries. */
export function headTransform(
  point: ArrowPoint,
  angle: number,
  arc: number,
  reverse = false
): string {
  const turn = (arc >= 0 ? 90 : -90) * (reverse ? -1 : 1)
  const degrees = (angle * 180) / Math.PI + turn
  return `translate(${point.x},${point.y}) rotate(${degrees})`
}

/** The pieces of a roughened path: Rough.js draws a curve as a run of subpaths
 * (`M… M…`), and each has to be its own element to be animated. */
export function splitPathDefinition(d: string): string[] {
  return d
    .split(/(?=M(?![a-z]))/)
    .map((part) => part.trim())
    .filter((part) => part !== '')
}

const NUMBER_PATTERN = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g

/**
 * The box containing the control points of the given path definitions.
 *
 * Rough.js emits only `M`, `L` and `C` commands with absolute coordinates, and
 * a bezier never leaves the convex hull of its control points, so the box is
 * guaranteed to contain the drawn path — which is what lets an animation mask
 * be sized to it.
 */
export function pathBounds(definitions: readonly string[]): ArrowBox | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const d of definitions) {
    const numbers = d.match(NUMBER_PATTERN)
    if (!numbers) continue
    for (let i = 0; i + 1 < numbers.length; i += 2) {
      const x = Number(numbers[i])
      const y = Number(numbers[i + 1])
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (minX > maxX) return null
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** How far a line is drawn for the reveal animation, a little past its own
 * length so a roughened path never stops short of the head. */
export function drawLength(lineLength: number): number {
  return lineLength * 1.05
}
