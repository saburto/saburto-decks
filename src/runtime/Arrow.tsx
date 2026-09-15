/**
 * A hand-drawn arrow between two things on a slide (R19), drawn with Rough.js.
 *
 * The author names the two ends — `<Arrow from="[data-id=a]@right"
 * to="(90%, 20%)" />` — and the deck draws a sketchy arrow between them. The
 * arrow is decoration: it lives in an SVG of its own, out of the slide's flow,
 * so it never changes the words it joins, the slide's layout, or the type size
 * the deck settles on.
 *
 * Several things follow from the deck being a shadow tree that scales its type
 * to its box, and all of them are handled here:
 *
 * - The drawing is an SVG portalled into the stage, beside the slide rather
 *   than inside it. A slide carries the entrance animation, whose `transform`
 *   would make it the containing block for an absolutely positioned child; the
 *   arrow has to measure against the stage instead. Only the slide the reader
 *   is on draws, so the stage holds one slide's arrows at a time.
 * - The ends are measured in screen pixels and drawn in the SVG's own units,
 *   which are the same. A percentage point is a fraction of the slide's box, so
 *   it follows the deck's box; an element is found in the slide by its
 *   selector. Both are remeasured whenever the slide, the stage or an endpoint
 *   changes size, so the arrow stays on what it points at.
 * - The drawing is loaded only when a slide actually has an arrow, so a deck
 *   without one ships neither Rough.js nor this component's drawing half.
 * - The arrow draws itself in when the reader reaches it, like an annotation
 *   (R15), unless the reader prefers reduced motion — and then it is simply
 *   there (N1).
 */
import { useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { SlideContext, SlideNumberContext } from './Slide'
import { useIsomorphicLayoutEffect } from './deck/dom'
import { stepAt } from './steps'
import {
  ARROW_DRAW_MS,
  anchorPoint,
  dashPattern,
  drawLength,
  parseArrowEndpoint,
  type ArrowBox,
  type ArrowDrawing,
  type ArrowEndpoint,
  type ArrowHeadType,
  type ArrowLineStyle,
  type ArrowPoint
} from './arrow-geometry'

type DrawArrow = (typeof import('./rough-arrow'))['drawArrow']

/** One load for the whole page, however many decks and arrows there are. */
let loading: Promise<typeof import('./rough-arrow')> | null = null
function loadArrow(): Promise<typeof import('./rough-arrow')> {
  loading ??= import('./rough-arrow')
  return loading
}

/** Deck palette names an arrow may name instead of a colour. A palette name is
 * a class so the colour follows the theme without redrawing; any other value
 * is a CSS colour, set on the drawing. */
const PALETTE_CLASS: Record<string, string> = {
  accent: 'text-sd-accent',
  muted: 'text-sd-muted',
  fg: 'text-sd-fg',
  bg: 'text-sd-bg',
  border: 'text-sd-border',
  highlight: 'text-sd-highlight'
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/** The reader's own preference, now and as it changes (N1). */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION).matches
  )
  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION)
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

/** A length the author wrote, resolved against the box it sits in. */
function lengthIn(length: { value: number; unit: 'px' | '%' }, total: number): number {
  return length.unit === '%' ? (length.value / 100) * total : length.value
}

/** The element an endpoint names, or nothing when the selector is unusable. */
function findElement(slide: Element, query: string): Element | null {
  try {
    return slide.querySelector(query)
  } catch {
    return null
  }
}

/** Where an endpoint's own box sits, once measured; the element it named is
 * kept so its size can be watched. */
interface Measured {
  box?: ArrowBox
  point?: ArrowPoint
  element?: Element
}

export interface ArrowProps {
  /** The tail: a point, `"(10%, 80%)"`, or an element, `"[data-id=a]@right"`. */
  from: string
  /** The head, in the same forms as `from`. */
  to: string
  /** The step the arrow is revealed on, 1-based and counted with the slide's
   * other steps (R12). Omit it to show the arrow with the slide. */
  at?: number | string
  /** A CSS colour, or a deck palette name (`accent`, `fg`, …), or nothing for
   * the deck's own text colour. */
  color?: string
  /** The line's thickness, in px. */
  width?: number
  /** How the line is drawn. */
  lineStyle?: ArrowLineStyle
  /** How the head is drawn: two strokes, or a filled triangle. */
  headType?: ArrowHeadType
  /** How long the head is, in px. It grows with the line when omitted. */
  headSize?: number
  /** Rough.js' roughness: 0 is a clean line, 1 the default sketch. */
  roughness?: number
  /** The random seed the hand-drawn line is generated from. Fixed by default,
   * so an arrow keeps its shape as the deck resizes. */
  seed?: number
  /** Put a head on each end. */
  twoWay?: boolean
  /** How far the line bows: 0 is straight, and the sign turns the bow. */
  arc?: number
}

export function Arrow({
  from,
  to,
  at,
  color,
  width = 2,
  lineStyle = 'solid',
  headType = 'line',
  headSize,
  roughness,
  seed = 1,
  twoWay = false,
  arc = 0
}: ArrowProps) {
  const { index, step, refresh } = useContext(SlideContext)
  const slide = useContext(SlideNumberContext)
  const anchorRef = useRef<HTMLSpanElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const drawn = useRef<ArrowDrawing | null>(null)
  const [stage, setStage] = useState<HTMLElement | null>(null)
  const [drawing, setDrawing] = useState<ArrowDrawing | null>(null)
  const [draw, setDraw] = useState<DrawArrow | null>(null)
  const rawId = useId()
  const maskId = `sd-arrow-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`

  const position = stepAt(at)
  /* The arrow is part of the slide it is written on, and shows once the reader
     has reached its step — and not while that slide is off screen. */
  const onSlide = slide === index
  const revealed = onSlide && step >= position - 1

  const fromSpec = useMemo(() => (from ? parseArrowEndpoint(from) : undefined), [from])
  const toSpec = useMemo(() => (to ? parseArrowEndpoint(to) : undefined), [to])

  const reduced = useReducedMotion()

  /* The drawing library, once a slide actually has an arrow. Until it arrives
     nothing is drawn; a deck with no arrow never loads it. */
  useEffect(() => {
    let cancelled = false
    void loadArrow().then((module) => {
      if (!cancelled) setDraw(() => module.drawArrow)
    })
    return () => {
      cancelled = true
    }
  }, [])

  /* Say so when an endpoint cannot be read, rather than leaving the author
     with an arrow that silently never appears. */
  useEffect(() => {
    if (from && !fromSpec) console.warn(`[saburto-decks] <Arrow> cannot read from="${from}"`)
    if (to && !toSpec) console.warn(`[saburto-decks] <Arrow> cannot read to="${to}"`)
  }, [from, to, fromSpec, toSpec])

  /* Where the arrow belongs: the stage around this slide. The slide itself is
     found again at measure time, so an include used inside a slide (R18)
     resolves its endpoints against the slide that holds it. */
  useIsomorphicLayoutEffect(() => {
    setStage(anchorRef.current?.closest<HTMLElement>('.stage') ?? null)
  }, [])

  /* Measure the ends and draw the arrow. It is remeasured whenever the stage,
     the slide or an endpoint changes size — the deck shrinks its type to fit
     its box, so an element's own size is not fixed — when content arrives
     late (R13), which is what `refresh` announces, and on every step, so an
     arrow keeps up with an object a step moves (R16). Nothing is drawn for a
     slide the reader is not on, or before the arrow's own step. */
  useIsomorphicLayoutEffect(() => {
    if (!draw || !onSlide || !revealed || !stage) {
      drawn.current = null
      setDrawing(null)
      return
    }
    const svg = svgRef.current
    const anchor = anchorRef.current
    if (!svg || !anchor || !fromSpec || !toSpec) {
      drawn.current = null
      setDrawing(null)
      return
    }
    const slideElement = anchor.closest('section.slide')
    if (!slideElement) {
      drawn.current = null
      setDrawing(null)
      return
    }

    let frame = 0
    const watched = new Set<Element>()
    const observer = new ResizeObserver(schedule)
    const mutations = new MutationObserver(schedule)

    function watch(element: Element | undefined): void {
      if (!element || watched.has(element)) return
      watched.add(element)
      observer.observe(element)
    }

    function schedule(): void {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }

    function measure(): void {
      const origin = svg!.getBoundingClientRect()
      const slideRect = slideElement!.getBoundingClientRect()

      const resolve = (endpoint: ArrowEndpoint): Measured | null => {
        if (endpoint.kind === 'point') {
          return {
            point: {
              x: slideRect.left - origin.left + lengthIn(endpoint.x, slideRect.width),
              y: slideRect.top - origin.top + lengthIn(endpoint.y, slideRect.height)
            }
          }
        }
        const element = findElement(slideElement!, endpoint.query)
        if (!element) return null
        const rect = element.getBoundingClientRect()
        return {
          box: { x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height },
          element
        }
      }

      const tail = resolve(fromSpec!)
      const head = resolve(toSpec!)
      watch(svg!)
      watch(slideElement!)
      watch(tail?.element)
      watch(head?.element)

      const centreOf = (measured: Measured): ArrowPoint =>
        measured.point ?? {
          x: (measured.box?.x ?? 0) + (measured.box?.width ?? 0) / 2,
          y: (measured.box?.y ?? 0) + (measured.box?.height ?? 0) / 2
        }

      const next =
        tail && head
          ? draw!(
              tail.point ?? anchorPoint(tail.box!, fromSpec!.kind === 'element' ? fromSpec!.anchor : null, centreOf(head)),
              head.point ?? anchorPoint(head.box!, toSpec!.kind === 'element' ? toSpec!.anchor : null, centreOf(tail)),
              { width, headType, headSize, roughness, seed, twoWay, arc }
            )
          : null

      const unchanged = JSON.stringify(drawn.current) === JSON.stringify(next)
      if (!unchanged) {
        drawn.current = next
        setDrawing(next)
      }
    }

    measure()
    mutations.observe(slideElement, { childList: true, subtree: true })
    /* The slide enters with a short animation that moves it; measuring while
       it is mid-flight would read a position the reader never sees. */
    slideElement.addEventListener('animationend', schedule)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      mutations.disconnect()
      slideElement.removeEventListener('animationend', schedule)
    }
  }, [draw, onSlide, revealed, step, stage, fromSpec, toSpec, refresh, width, headType, headSize, roughness, seed, twoWay, arc])

  const paletteClass = color ? PALETTE_CLASS[color] : undefined
  const colour = color && !paletteClass ? ({ color } as CSSProperties) : undefined

  const dash = dashPattern(lineStyle, width)
  const animate = revealed && !reduced
  const masked = animate && dash !== undefined
  const lineDraw = drawing ? drawLength(drawing.lineLength) : 1
  const headCount = drawing?.heads.length ?? 0
  const total = (drawing?.lineLength ?? 0) + headCount * (drawing?.headLength ?? 0) * 2
  const lineMs = total > 0 ? ARROW_DRAW_MS * ((drawing?.lineLength ?? 0) / total) : 0
  const headMs = total > 0 ? ARROW_DRAW_MS * (((drawing?.headLength ?? 0) * 2) / total) : 0

  const stroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: width,
    strokeLinejoin: 'round' as const,
    strokeLinecap: lineStyle === 'dotted' ? ('round' as const) : undefined
  }

  const bounds = drawing?.bounds ?? null
  /* Twice the line's width, so the revealed stroke sits clear of the mask
     edge, where antialiasing would dim it. */
  const maskWidth = width * 2

  return (
    <>
      {/* The arrow's place in the slide: an empty box the deck counts steps
          from, never a thing that takes room (R12, R19). */}
      <span ref={anchorRef} hidden className="sd-arrow-anchor" data-steps={position} />

      {onSlide &&
        stage &&
        createPortal(
          <svg
            ref={svgRef}
            className={`sd-arrow absolute left-0 top-0 h-full w-full overflow-visible pointer-events-none ${paletteClass ?? ''}`}
            style={colour}
            aria-hidden="true"
            data-steps={position}
          >
            {revealed && drawing && (
              <>
                {masked && bounds && (
                  <defs>
                    <mask
                      id={maskId}
                      maskUnits="userSpaceOnUse"
                      x={bounds.x - maskWidth}
                      y={bounds.y - maskWidth}
                      width={bounds.width + maskWidth * 2}
                      height={bounds.height + maskWidth * 2}
                    >
                      {/* The dash pattern and a draw animation both live in
                          `stroke-dasharray`, so they cannot share an element:
                          the line is drawn on white copies inside the mask,
                          and the dashed line is revealed through them. */}
                      {drawing.line.map((path, i) => (
                        <path
                          key={i}
                          d={path.d}
                          fill="none"
                          stroke="#fff"
                          strokeWidth={maskWidth}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="sd-arrow-stroke"
                          strokeDasharray={lineDraw}
                          strokeDashoffset={lineDraw}
                          style={{ animationDuration: `${lineMs}ms` }}
                        />
                      ))}
                    </mask>
                  </defs>
                )}

                <g mask={masked && bounds ? `url(#${maskId})` : undefined}>
                  {drawing.line.map((path, i) =>
                    masked ? (
                      <path key={i} {...stroke} d={path.d} strokeDasharray={dash!.join(' ')} />
                    ) : animate ? (
                      <path
                        key={i}
                        {...stroke}
                        d={path.d}
                        className="sd-arrow-stroke"
                        strokeDasharray={lineDraw}
                        strokeDashoffset={lineDraw}
                        style={{ animationDuration: `${lineMs}ms` }}
                      />
                    ) : (
                      <path key={i} {...stroke} d={path.d} strokeDasharray={dash?.join(' ')} />
                    )
                  )}
                </g>

                {drawing.heads.map((head, h) => (
                  <g
                    key={h}
                    transform={head.transform}
                    className={animate ? 'sd-arrow-head' : undefined}
                    style={
                      animate
                        ? {
                            visibility: 'hidden',
                            animationDuration: `${headMs}ms`,
                            animationDelay: `${lineMs + h * headMs}ms`
                          }
                        : undefined
                    }
                  >
                    {head.paths.map((path, i) => (
                      <path
                        key={i}
                        d={path.d}
                        fill={path.filled ? 'currentColor' : 'none'}
                        stroke={path.filled ? 'none' : 'currentColor'}
                        strokeWidth={width}
                      />
                    ))}
                  </g>
                ))}
              </>
            )}
          </svg>,
          stage
        )}
    </>
  )
}

export default Arrow
