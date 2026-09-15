/**
 * Drawing an arrow with Rough.js (R19).
 *
 * This is the one module that reaches for Rough.js, and it is loaded with a
 * dynamic `import()` so a deck without an arrow never ships it — the same
 * arrangement the annotations and the motion library use (R15, R16).
 *
 * It takes points already measured by `Arrow.tsx` and returns plain
 * descriptors — path definitions, transforms, whether a path is filled — so
 * React can render them and no DOM is built here. The arrows are drawn with
 * `generator()`, which needs no browser, so the drawing can be tested without
 * one.
 */
import rough from 'roughjs'
import {
  arcGeometry,
  headLengthFor,
  headTransform,
  pathBounds,
  splitPathDefinition,
  type ArrowDrawing,
  type ArrowHeadType,
  type ArrowPoint
} from './arrow-geometry'

/** The look of an arrow, as the author asked for it. */
export interface ArrowStyle {
  width: number
  headType: ArrowHeadType
  headSize?: number
  roughness?: number
  seed: number
  twoWay: boolean
  arc: number
}

/** One generator for the page: it is stateless, and every arrow passes its own
 * `seed`, so no two drawings interfere. */
const generator = rough.generator()

/** Half the head's opening angle: 30°. Its point is the origin and its tail
 * reaches back along −x, so a rotation alone aims it. */
const HEAD_ANGLE = Math.PI / 6

export function drawArrow(
  point1: ArrowPoint,
  point2: ArrowPoint,
  style: ArrowStyle
): ArrowDrawing | null {
  const geometry = arcGeometry(point1, point2, style.arc)
  if (!geometry) return null

  const base = {
    stroke: 'currentColor',
    strokeWidth: style.width,
    roughness: style.roughness ?? 1,
    seed: style.seed
  }

  const line = generator
    .toPaths(generator.path(geometry.d, base))
    .flatMap((path) => splitPathDefinition(path.d).map((d) => ({ d, filled: false })))

  const headLength = headLengthFor(geometry.length, style.headSize)
  const tail = [-headLength * Math.cos(HEAD_ANGLE), headLength * Math.sin(HEAD_ANGLE)] as [
    number,
    number
  ]
  const tip = [-headLength * Math.cos(HEAD_ANGLE), -headLength * Math.sin(HEAD_ANGLE)] as [
    number,
    number
  ]

  /* The head is always at the far end; a two-way arrow carries the same head,
     facing back the way it came, at the near end. */
  const ends: Array<[ArrowPoint, number, boolean]> = [[point2, geometry.angle2, false]]
  if (style.twoWay) ends.push([point1, geometry.angle1, true])

  const heads = ends.map(([point, angle, reverse]) => {
    const drawables =
      style.headType === 'polygon'
        ? [
            generator.polygon([tail, [0, 0], tip], {
              ...base,
              fill: 'currentColor',
              fillStyle: 'solid'
            })
          ]
        : [generator.line(tail[0], tail[1], 0, 0, base), generator.line(tip[0], tip[1], 0, 0, base)]

    const paths = drawables.flatMap((drawable) =>
      generator
        .toPaths(drawable)
        .flatMap((path) =>
          splitPathDefinition(path.d).map((d) => ({ d, filled: (path.fill ?? 'none') !== 'none' }))
        )
    )

    return { transform: headTransform(point, angle, style.arc, reverse), paths }
  })

  return {
    line,
    heads,
    lineLength: geometry.length,
    headLength,
    bounds: pathBounds(line.map((path) => path.d))
  }
}
