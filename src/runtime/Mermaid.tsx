/**
 * A Mermaid diagram, drawn in the deck.
 *
 * Mermaid needs a real DOM to lay a diagram out, so the drawing happens in the
 * browser rather than at build time (R13). Mermaid is loaded on first use, so a
 * deck without a diagram never pays for it.
 *
 * The component's job is to hand the source to Mermaid, put the drawing it
 * produces into the slide, and mark the parts a diagram reveals one at a time
 * (R14). The reveal itself is applied by the deck, which owns the reader's
 * position; the diagram only says which element belongs to which step and asks
 * the deck to look again.
 */
import { useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { SlideContext, type DeckTheme } from './Slide'
import { assignDiagramSteps } from './mermaid-steps'

type MermaidApi = (typeof import('mermaid'))['default']

/** One load for the whole page, however many decks and diagrams there are. */
let loading: Promise<MermaidApi> | null = null
function loadMermaid(): Promise<MermaidApi> {
  loading ??= import('mermaid').then((module) => module.default)
  return loading
}

/** The deck's own font, so a diagram's labels sit with the slide's text. */
const DIAGRAM_FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

/** The palette Mermaid should draw in. The deck never guesses, and neither
 * does the diagram: `system` is resolved here, to light or dark. */
function useResolvedTheme(theme: DeckTheme): 'light' | 'dark' {
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemDark(media.matches)
    const onChange = () => setSystemDark(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  return theme === 'dark' || (theme === 'system' && systemDark) ? 'dark' : 'light'
}

export interface MermaidProps {
  /** The diagram source, as written in the deck file. */
  children?: ReactNode
  /** `"true"` when the author asked for the whole diagram at once (R14). */
  'data-full'?: string
}

export function Mermaid({ children, 'data-full': full }: MermaidProps) {
  const chart = typeof children === 'string' ? children : String(children ?? '')
  const { theme, refresh, measure } = useContext(SlideContext)
  const resolved = useResolvedTheme(theme)
  const target = useRef<HTMLSpanElement | null>(null)
  const run = useRef(0)
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [steps, setSteps] = useState(1)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const host = target.current
    /* Nothing to draw into yet: wait for the deck's measuring container. */
    if (!host || !chart.trim() || !measure) return
    let cancelled = false

    /* A fresh id per render: Mermaid uses it to scope the styles it writes into
       the drawing, and two renders must never share one. */
    const id = `sd-mermaid-${reactId}-${++run.current}`
    const source = `%%{init: ${JSON.stringify({ theme: resolved, fontFamily: DIAGRAM_FONT })}}%%\n${chart}`

    void (async () => {
      try {
        const mermaid = await loadMermaid()
        /* Mermaid measures the diagram by laying it out in the document, so it
           is handed the deck's own measuring container rather than the page
           body: the measurement is invisible and never changes the page's
           height (R7, R13). */
        const { svg } = await mermaid.render(id, source, measure)
        if (cancelled) return
        host.innerHTML = svg

        const drawn = host.querySelector('svg')
        if (drawn) {
          /* Mermaid caps the drawing at the width it measured; the deck sizes
             it to the slide instead, and scales it to fit like all content. */
          drawn.removeAttribute('style')
          drawn.setAttribute('width', '100%')
        }
        const whole = full === 'true'
        setSteps(!drawn || whole ? 1 : assignDiagramSteps(drawn))
        setFailed(false)
      } catch {
        if (cancelled) return
        host.innerHTML = ''
        setSteps(1)
        setFailed(true)
      } finally {
        /* Whether it drew or not, the deck has something new to measure and a
           step to apply. */
        if (!cancelled) refresh()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [chart, resolved, full, reactId, refresh, measure])

  return (
    <div className="sd-mermaid" data-steps={steps}>
      {/* The source is the fallback: hidden while Mermaid draws, shown only if
          Mermaid cannot run. */}
      <span className="sd-mermaid-source" hidden={!failed}>
        {chart}
      </span>
      <span className="sd-mermaid-render" ref={target} />
    </div>
  )
}

export default Mermaid
