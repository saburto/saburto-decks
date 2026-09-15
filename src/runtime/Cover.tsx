import { type ReactNode } from 'react'
import { useStageBox } from './stage'

export interface CoverProps {
  /** The title across the top. */
  title?: ReactNode
  /** The small line under the body — a date, an author, a source. */
  meta?: ReactNode
  /** The body: the paragraphs the reader reads first. */
  children?: ReactNode
  /** The left-hand column at the foot. */
  left?: ReactNode
  /** The right-hand column at the foot. */
  right?: ReactNode
  className?: string
}

/**
 * A cover layout: a title, a body, and a footer of two columns (R5).
 *
 * It is the deck's answer to a front page that uses the whole slide rather
 * than a column of text: the title sits at the top, the body is centred in the
 * room that is left, and the two foot columns sit at the bottom. The component
 * measures the stage so the three bands spread over its full height; without
 * that the columns would simply stack.
 *
 * Everything is sized in the deck's own units — `em` and `cqi`, not `rem` and
 * viewport breakpoints — so the layout scales with the deck's box and with the
 * type size the deck settles on, exactly as the rest of a slide does.
 */
export function Cover({ title, meta, children, left, right, className }: CoverProps) {
  const { ref: box, height } = useStageBox<HTMLElement>()

  return (
    <main
      ref={box}
      className={`flex flex-col justify-between gap-[2em] ${className ?? ''}`}
      style={height ? { minHeight: height } : undefined}
    >
      {title !== undefined && (
        <div className="mx-auto w-full max-w-[64cqi] text-center">
          <h1 className="text-[2em] font-extrabold tracking-tight text-balance">{title}</h1>
        </div>
      )}

      <div className="mx-auto my-auto w-full max-w-[64cqi] py-[1.25em]">
        <div className="space-y-[0.9em] text-justify text-[1em] leading-snug text-sd-muted">
          {children}
        </div>
        {meta !== undefined && <p className="mt-[0.9em] text-[0.85em] text-sd-muted">{meta}</p>}
      </div>

      {(left !== undefined || right !== undefined) && (
        <div className="flex flex-col justify-between gap-[1.5em] text-[0.75em] leading-snug text-sd-muted sm:flex-row sm:items-end [&>div]:max-w-[30cqi]">
          {left !== undefined && <div>{left}</div>}
          {right !== undefined && <div className="sm:text-right">{right}</div>}
        </div>
      )}
    </main>
  )
}

export default Cover
