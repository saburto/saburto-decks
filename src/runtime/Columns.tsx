import { useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { SlideContext } from './Slide'

export interface ColumnsProps {
  /** The title across the top. */
  title?: ReactNode
  /** A short lead under the title, spanning both columns. */
  lead?: ReactNode
  /** How the two columns share the width. `[2, 3]` is 40% / 60%. */
  ratio?: [number, number]
  /** The columns: two of them, side by side. */
  children?: ReactNode
  className?: string
}

/**
 * A two-column layout: a title, then the two columns beneath it (R5).
 *
 * A slide with two bodies of text — a definition and its detail, a problem and
 * its fix — reads better as two columns than as one long one. The columns are
 * top-aligned and take the height under the title; at a narrow box they stack.
 *
 * Like `Cover` and `Agenda` it measures the stage to fill the slide, and
 * everything is sized in the deck's own units, so it scales with the deck's box
 * and with the type size the deck settles on.
 */
export function Columns({ title, lead, ratio = [1, 1], children, className }: ColumnsProps) {
  const { refresh } = useContext(SlideContext)
  const box = useRef<HTMLElement | null>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    const stage = box.current?.closest<HTMLElement>('.stage')
    if (!stage) return

    const fit = () => {
      const style = getComputedStyle(stage)
      setHeight(
        stage.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom)
      )
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [refresh])

  return (
    <main
      ref={box}
      className={`flex flex-col gap-[1.5em] ${className ?? ''}`}
      style={height ? { minHeight: height } : undefined}
    >
      {title !== undefined && (
        <h1 className="mx-auto max-w-[44em] text-center text-[2em] font-extrabold tracking-tight text-balance">
          {title}
        </h1>
      )}
      {lead !== undefined && (
        <p className="mx-auto mt-[-1em] max-w-[50em] text-center text-[1em] text-sd-muted">{lead}</p>
      )}
      <div
        className="mx-auto grid w-full max-w-[64cqi] flex-1 items-start gap-[2em] sm:grid-cols-[var(--sd-columns)]"
        style={{ '--sd-columns': `${ratio[0]}fr ${ratio[1]}fr` } as CSSProperties}
      >
        {children}
      </div>
    </main>
  )
}

export default Columns
