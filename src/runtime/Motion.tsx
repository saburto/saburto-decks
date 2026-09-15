/**
 * Objects that arrive and move on a slide (R16), animated with
 * [Motion](https://motion.dev).
 *
 * A deck author wraps an object in `<Appear>` to have it arrive on a step, or
 * in `<Move>` to have it move on one. Both are steps of the slide in exactly
 * the sense a code block's highlights are (R12): `→` and the
 * bar's next control advance to them, `←` reverses them, the bar counts
 * them, and a host drives and observes them with `goToStep`.
 *
 * Three things follow from the deck being a shadow tree that sizes its type to
 * its box, and all of them are handled here:
 *
 * - An object that has not been reached keeps its place. It is hidden with
 *   opacity and moved with a transform, never with `display` and never by
 *   leaving the document, so nothing else on the slide shifts as the steps
 *   move and the type size the deck settled on does not change under the
 *   reader (R16).
 * - An object that is not shown yet is inert, so it is not read out or focused
 *   while it cannot be seen (N1).
 * - With reduced motion the object is simply put where it belongs, with no
 *   animation at all (N1).
 *
 * The library is loaded only when a slide actually has an object, so a deck
 * without motion ships none of it — the same arrangement as an annotation's
 * drawing library (R15).
 */
import {
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode
} from 'react'
import type { Transition } from 'motion/react'
import { SlideContext, SlideNumberContext } from './Slide'
import { stepAt } from './steps'

type MotionModule = typeof import('motion/react')

/** One load for the whole page, however many decks and objects there are. */
let loading: Promise<MotionModule> | null = null
function loadMotion(): Promise<MotionModule> {
  loading ??= import('motion/react')
  return loading
}

/**
 * The animation library, once it has arrived. Until then the object is
 * rendered plain, in the state it belongs in, so it cannot flash on screen
 * before the library that would have hidden it is there.
 */
function useMotionLibrary(): MotionModule | null {
  const [library, setLibrary] = useState<MotionModule | null>(null)
  useEffect(() => {
    let cancelled = false
    void loadMotion().then((loaded) => {
      if (!cancelled) setLibrary(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return library
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

/** The properties an object can be given. Motion writes them; the deck only
 * decides which of them a step names. */
export interface MotionValues {
  opacity?: number
  x?: number
  y?: number
  rotate?: number
  scale?: number
}

/** Every property, in the one order a transform is built in. */
const PROPERTIES = ['opacity', 'x', 'y', 'rotate', 'scale'] as const

/** Where each property rests: the state an object is in before its step, and
 * the state it returns to when the reader steps back. */
const REST: Required<MotionValues> = { opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }

/** Only the properties actually named, so a transform carries nothing the
 * author did not ask for and is built the same way every render. Earlier
 * sources win, which is how an author's `from` overrides a default. */
function named(...sources: (MotionValues | undefined)[]): MotionValues {
  const values: MotionValues = {}
  for (const property of PROPERTIES) {
    for (const source of sources) {
      const value = source?.[property]
      if (value !== undefined) {
        values[property] = value
        break
      }
    }
  }
  return values
}

/** Where each named property rests — what `from` defaults to, and what every
 * `to` defaults to. Exported for its own test. */
export function resting(values: MotionValues): MotionValues {
  const out: MotionValues = {}
  for (const property of PROPERTIES) {
    if (values[property] !== undefined) out[property] = REST[property]
  }
  return out
}

/** The deck's own timing: short, and the same everywhere. */
const DEFAULT_TRANSITION: Transition = { duration: 0.25, ease: 'easeOut' }
/** Put it there, do not move it there. */
const STILL: Transition = { duration: 0 }

/**
 * The transition an object uses: the author's, or the deck's, or none at all
 * when the reader prefers reduced motion (N1) or when the object's slide is
 * not on screen — a slide that is off screen has nothing to watch, so it is
 * simply put in its state. Exported for its own test.
 */
export function effectiveTransition(
  active: boolean,
  reduced: boolean,
  transition: Transition | undefined
): Transition {
  return active && !reduced ? (transition ?? DEFAULT_TRANSITION) : STILL
}

/** The same state as a plain style, for the moment before the library arrives.
 * The order of a transform is Motion's own: translate, then scale, then
 * rotate. */
export function motionStyle(values: MotionValues): CSSProperties {
  const style: CSSProperties = {}
  if (values.opacity !== undefined) style.opacity = values.opacity
  const transform: string[] = []
  if (values.x !== undefined) transform.push(`translateX(${values.x}px)`)
  if (values.y !== undefined) transform.push(`translateY(${values.y}px)`)
  if (values.scale !== undefined) transform.push(`scale(${values.scale})`)
  if (values.rotate !== undefined) transform.push(`rotate(${values.rotate}deg)`)
  if (transform.length) style.transform = transform.join(' ')
  return style
}

/** `span` sits inside a paragraph; `div` takes a line of its own. */
export type MotionTag = 'span' | 'div'

type AnimatedComponent = ComponentType<Record<string, unknown>>

interface AnimatedProps {
  kind: 'appear' | 'move'
  at?: number | string
  /** Where the object is before its step. */
  start: MotionValues
  /** Where it is from its step on. */
  end: MotionValues
  transition?: Transition
  layout: boolean
  as: MotionTag
  className?: string
  children?: ReactNode
}

function Animated({
  kind,
  at,
  start,
  end,
  transition,
  layout,
  as,
  className,
  children
}: AnimatedProps) {
  const { index, step } = useContext(SlideContext)
  const slide = useContext(SlideNumberContext)
  const library = useMotionLibrary()
  const reduced = useReducedMotion()

  const position = stepAt(at)
  /* The reader's step decides which end of the move the object is at; the
     slide the object is written on decides whether it is on screen at all. */
  const reached = step >= position - 1
  const active = slide === index
  const target = reached ? end : start

  /* Where the object was when it first rendered. A reader who arrives at a
     slide already past the step must not see the object animate in: it has not
     moved, it is simply there. */
  const mounted = useRef(target)

  const base = 'sd-motion inline-block max-w-full data-[as=div]:block'
  const classes = className ? `${base} ${className}` : base
  /* Shown and moved by opacity and transform only, so the object keeps its
     place in the slide's layout whether or not it has been reached (R16). An
     object not yet reached is inert so it is not read out or focused. */
  const inert = kind === 'appear' && !reached

  if (!library) {
    const Plain = as
    return (
      <Plain
        className={classes}
        data-motion={kind}
        data-as={as}
        data-steps={position}
        style={motionStyle(target)}
        inert={inert}
      >
        {children}
      </Plain>
    )
  }

  const Component = (as === 'div'
    ? library.motion.div
    : library.motion.span) as unknown as AnimatedComponent

  return (
    <Component
      className={classes}
      data-motion={kind}
      data-as={as}
      data-steps={position}
      initial={mounted.current}
      animate={target}
      transition={effectiveTransition(active, reduced, transition)}
      layout={layout && !reduced}
      inert={inert}
    >
      {children}
    </Component>
  )
}

export interface AppearProps {
  /** The step it arrives on, 1-based and counted with the slide's other steps
   * (R12, R16). Omit it to have it on the slide from the start. */
  at?: number | string
  /** Where it arrives from. A short fade and rise by default. */
  from?: MotionValues
  /** Where it settles. By default, the resting value of everything `from`
   * names — `opacity` 1, `x` and `y` 0, `rotate` 0, `scale` 1. */
  to?: MotionValues
  /** A Motion transition, overriding the deck's short ease-out. */
  transition?: Transition
  /** Animate to wherever the slide's layout puts it as well. Off by default:
   * an object that arrives reserves its place, so nothing around it moves. */
  layout?: boolean
  /** `span` (the default) sits inside a paragraph; `div` takes a line of its own. */
  as?: MotionTag
  className?: string
  children?: ReactNode
}

/** An object that arrives on one of the slide's steps (R16). */
export function Appear({
  at,
  from,
  to,
  transition,
  layout = false,
  as = 'span',
  className,
  children
}: AppearProps) {
  const start = named({ opacity: 0, y: 8 }, from)
  const end = named(resting(start), to)
  return (
    <Animated
      kind="appear"
      at={at}
      start={start}
      end={end}
      transition={transition}
      layout={layout}
      as={as}
      className={className}
    >
      {children}
    </Animated>
  )
}

export interface MoveProps {
  /** The step it moves on, 1-based and counted with the slide's other steps
   * (R12, R16). */
  at?: number | string
  /** Where it starts. Where the object already is, by default. */
  from?: MotionValues
  /** Where it moves to. */
  to?: MotionValues
  /** Shorthands for a single `to`: `x` and `y` in px, `rotate` in degrees,
   * `scale` as a factor. */
  x?: number
  y?: number
  rotate?: number
  scale?: number
  /** A Motion transition, overriding the deck's short ease-out. */
  transition?: Transition
  /** Animate to wherever the slide's layout puts it as well, as well as to
   * `to`. On by default — this is a moving object (R16). */
  layout?: boolean
  /** `span` (the default) sits inside a paragraph; `div` takes a line of its own. */
  as?: MotionTag
  className?: string
  children?: ReactNode
}

/** An object that moves on one of the slide's steps (R16). */
export function Move({
  at,
  from,
  to,
  x,
  y,
  rotate,
  scale,
  transition,
  layout = true,
  as = 'span',
  className,
  children
}: MoveProps) {
  const end = named({ x, y, rotate, scale }, to)
  const start = named(resting(end), from)
  return (
    <Animated
      kind="move"
      at={at}
      start={start}
      end={end}
      transition={transition}
      layout={layout}
      as={as}
      className={className}
    >
      {children}
    </Animated>
  )
}
