import type { ReactNode } from 'react'

export interface BlockProps {
  /** The block's own heading — the subtitle of a grid cell. */
  title?: ReactNode
  /** A short line under the heading. */
  lead?: ReactNode
  /** The block's text. */
  children?: ReactNode
  className?: string
}

/**
 * One block of a grid, a column or a stack (R5): a short heading, an optional
 * lead, and the text itself.
 *
 * It is deliberately plain — no box, no surface — so a grid of blocks reads as
 * a page of typography rather than a dashboard of cards. `Grid`, `Columns` and
 * `Stack` only place blocks; `Block` is what a block's own text hierarchy
 * looks like everywhere, so the eight typical layouts are built from the same
 * part.
 */
export function Block({ title, lead, children, className }: BlockProps) {
  return (
    <div className={`flex flex-col gap-[0.35em] ${className ?? ''}`}>
      {title !== undefined && (
        <h3 className="m-0 text-[1.05em] font-semibold leading-tight">{title}</h3>
      )}
      {lead !== undefined && <p className="m-0 text-[0.85em] leading-snug text-sd-muted">{lead}</p>}
      {children !== undefined && (
        <div className="text-[0.95em] leading-snug text-sd-muted [&>:first-child]:mt-0 [&>:last-child]:mb-0">
          {children}
        </div>
      )}
    </div>
  )
}

export default Block
