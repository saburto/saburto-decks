import type { ReactNode } from 'react'
import { useStageHeight } from './stage'

export interface GridProps {
  /** The title across the top. */
  title?: ReactNode
  /** A short lead under the title. */
  lead?: ReactNode
  /** How many blocks across: `2` for a 2×2, `3` for a 3×2 (R5). */
  columns?: number
  /** The blocks: as many as there are cells. */
  children?: ReactNode
  className?: string
}

/**
 * A grid layout: a title, then the blocks in as many columns as asked (R5).
 *
 * It is the companion to `Columns` for a slide that carries several short
 * blocks of equal weight rather than two passages: four blocks in a 2×2, six
 * in a 3×2. The blocks are the component's children, so each one can be a
 * `<Block>`, a `<Figure>`, a diagram, or anything else a slide holds. They are
 * aligned to the top of their row and the grid is centred in the room under
 * the title.
 *
 * Like `Cover` and `Agenda` it measures the stage, so the grid spreads over the
 * slide's full height, and everything is sized in the deck's own units, so it
 * scales with the deck's box and with the type size the deck settles on.
 */
export function Grid({ title, lead, columns = 2, children, className }: GridProps) {
  const { ref, height } = useStageHeight<HTMLElement>()

  return (
    <main
      ref={ref}
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
        className="mx-auto grid w-full max-w-[64cqi] flex-1 content-center items-start gap-[1.5em]"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(0, 1fr))` }}
      >
        {children}
      </div>
    </main>
  )
}

export default Grid
