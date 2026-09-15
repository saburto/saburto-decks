/**
 * A hand-drawn annotation over a passage, drawn with rough-notation (R15).
 *
 * The author wraps the words they want to bring forward — `<Mark type="box">Full
 * screen</Mark>` — and the deck draws a sketchy mark over them. The annotation
 * is decoration: the passage is on the slide whether or not the mark is, so it
 * never changes the text, its layout, or the type size the deck settles on.
 *
 * Several things follow from the deck being a shadow tree that scales its type
 * to its box, and all of them are handled here:
 *
 * - The drawing is an SVG beside the passage, positioned out of the flow, so
 *   measuring a slide (`fitStage`) never sees it.
 * - rough-notation writes its draw keyframes into `document.head` the first
 *   time it attaches anything. The deck declares those keyframes in its own
 *   shadow stylesheet instead and tells the library they are already there, so
 *   nothing of the deck's styling reaches the host page (R8).
 * - The passage is remeasured whenever its size changes — the stage shrinks the
 *   type to fit — and the mark is redrawn, so it stays on the words it marks.
 * - The drawing is loaded only when a slide actually has a mark, so a deck
 *   without one ships neither the library nor its `roughjs` dependency.
 */
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { SlideContext, SlideNumberContext } from './Slide'
import { stepAt } from './steps'

/** The annotation kinds rough-notation knows how to draw. */
export type MarkType =
  'highlight' | 'underline' | 'box' | 'circle' | 'strike-through' | 'crossed-off' | 'bracket'

/** Where a bracket annotation sits, when it is a bracket. */
export type MarkBracket = 'left' | 'right' | 'top' | 'bottom'

/** Deck palette names an annotation may name instead of a colour. */
const PALETTE: Record<string, string> = {
  accent: '--sd-accent',
  muted: '--sd-muted',
  fg: '--sd-fg',
  bg: '--sd-bg',
  highlight: '--sd-highlight'
}

type Annotate = (typeof import('rough-notation'))['annotate']
type Annotation = ReturnType<Annotate>

/** One load for the whole page, however many decks and annotations there are. */
let loading: Promise<Annotate> | null = null
function loadAnnotate(): Promise<Annotate> {
  loading ??= import('rough-notation').then((module) => module.annotate)
  return loading
}

/**
 * rough-notation injects its draw keyframes into `document.head` on first use.
 * That is the one thing it does outside the deck's shadow root, and R8 says
 * nothing of the deck's styling may reach the host page. The deck's own
 * stylesheet declares those keyframes inside the shadow tree — where the
 * annotations live, and in browsers that scope keyframes to the tree — so the
 * library is told they are already there.
 */
function keepKeyframesInShadowRoot(): void {
  ;(window as unknown as { __rno_kf_s?: boolean }).__rno_kf_s = true
}

/** The reader's own preference, read when the mark is drawn (N1). */
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * A colour an SVG attribute can carry. A palette name is resolved against the
 * deck's own variables, because a presentation attribute does not accept
 * `var()` everywhere and the drawn stroke cannot follow a theme by itself.
 * `currentColor` — the default for the outlines — is left alone: it follows the
 * text, and the theme with it. A highlight is the exception: it is drawn as a
 * thick stroke *behind* the words, so drawing it in the text's own colour
 * would black the words out. It uses the deck's highlight colour instead, which
 * is translucent precisely so the words stay readable under it (R15).
 */
function resolveColor(color: string | undefined, type: MarkType, element: HTMLElement): string {
  const name = color ?? (type === 'highlight' ? 'highlight' : undefined)
  if (!name) return 'currentColor'
  const property = PALETTE[name]
  if (!property) return name
  return getComputedStyle(element).getPropertyValue(property).trim() || 'currentColor'
}

export interface MarkProps {
  /** What to draw. A highlight by default. */
  type?: MarkType
  /** A CSS colour, a deck palette name (`accent`, `fg`, …), or nothing for the
   * text's own colour. */
  color?: string
  /** The step to reveal the annotation on, 1-based and counted with the
   * slide's other steps (R12). Omit it to show the mark with the slide. */
  at?: number | string
  /** Draw the mark per line, for a passage that wraps. */
  multiline?: boolean
  /** Which side a `bracket` sits on. */
  brackets?: MarkBracket | MarkBracket[]
  children?: ReactNode
}

export function Mark({
  type = 'highlight',
  color,
  at,
  multiline = false,
  brackets,
  children
}: MarkProps) {
  const { index, step, theme } = useContext(SlideContext)
  const slide = useContext(SlideNumberContext)
  const target = useRef<HTMLSpanElement | null>(null)
  const annotation = useRef<Annotation | null>(null)
  const [ready, setReady] = useState(0)

  const position = stepAt(at)
  /* The mark is part of the slide it is written on, and shows once the reader
     has reached its step — and not while that slide is off screen, where there
     is nothing to measure against. */
  const revealed = slide === index && step >= position - 1

  /* Build the annotation once the library has arrived. It is attached but not
     shown: what is shown is the reader's step. */
  useEffect(() => {
    const element = target.current
    if (!element) return
    let cancelled = false

    void (async () => {
      const annotate = await loadAnnotate()
      if (cancelled || annotation.current || !element.isConnected) return
      keepKeyframesInShadowRoot()
      annotation.current = annotate(element, {
        type,
        color: resolveColor(color, type, element),
        multiline,
        animate: !prefersReducedMotion(),
        brackets
      })
      /* The drawing is decoration: the words already carry the meaning, so the
         mark is kept out of the accessibility tree (N1, R15). */
      element.parentElement
        ?.querySelector('svg.rough-annotation')
        ?.setAttribute('aria-hidden', 'true')
      setReady((revision) => revision + 1)
    })()

    return () => {
      cancelled = true
    }
  }, [type, color, multiline, brackets])

  /* Show or hide it with the reader's step. While it is shown, watch the
     passage: the stage shrinks the type to fit the slide, and a mark measured
     against the old size would sit in the wrong place (R15). */
  useEffect(() => {
    const drawn = annotation.current
    if (!drawn) return
    if (!revealed) {
      drawn.hide()
      return
    }

    const element = target.current
    let width = -1
    let height = -1
    /* Draw at the size the passage has now, and remember it. A ResizeObserver
       delivers one callback as soon as it starts observing, and redrawing
       there — as rough-notation does, without the draw animation — would cut
       the animation short before it was seen. Only a real change in size is a
       redraw. */
    const draw = () => {
      const box = element?.getBoundingClientRect()
      if (box && box.width === width && box.height === height) return
      width = box?.width ?? -1
      height = box?.height ?? -1
      drawn.show()
    }

    const observer = element ? new ResizeObserver(draw) : null
    if (element) observer?.observe(element)
    draw()
    return () => observer?.disconnect()
  }, [revealed, ready])

  /* The palette can change under the mark, and the colour is baked into the
     drawing, so a theme change is a redraw. `currentColor` looks after itself. */
  useEffect(() => {
    const drawn = annotation.current
    const element = target.current
    if (drawn && element) drawn.color = resolveColor(color, type, element)
  }, [theme, color, type, ready])

  useEffect(
    () => () => {
      annotation.current?.remove()
      annotation.current = null
    },
    []
  )

  return (
    <span className="sd-mark" data-steps={position} data-mark={type}>
      {/* A span of its own for the library to draw against: React owns the
          words, rough-notation inserts its SVG beside them. */}
      <span ref={target}>{children}</span>
    </span>
  )
}

export default Mark
