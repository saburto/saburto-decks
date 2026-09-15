import type { ReactNode } from 'react'

export interface StackProps {
  /** The gap between the blocks, in the deck's own ems. */
  gap?: number
  /** The blocks, one above another. */
  children?: ReactNode
  className?: string
}

/**
 * A column of blocks, one above another (R5).
 *
 * `Columns` places its children side by side, so several blocks on one side of
 * it have to be one child: a column of three blocks is a `Stack` of three
 * blocks. It is also the way to put a heading over a short group, as in the
 * two-subtitles layout.
 *
 * The gap is in the deck's own units, so the stack keeps its proportions as
 * the type size changes.
 */
export function Stack({ gap = 1, children, className }: StackProps) {
  return (
    <div className={`flex flex-col ${className ?? ''}`} style={{ gap: `${gap}em` }}>
      {children}
    </div>
  )
}

export default Stack
