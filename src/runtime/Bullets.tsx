import type { ReactNode } from 'react'
import { useStageBox } from './stage'

export interface BulletsProps {
  /** The title across the top. */
  title?: ReactNode
  /** A short lead under the title. */
  lead?: ReactNode
  /** The list. Written as ordinary Markdown, so its own markers are used. */
  children?: ReactNode
  className?: string
}

/**
 * A bullet layout: a title, then a list (R5).
 *
 * The list is the component's child, so it is written the way a list always
 * is — blank lines and all:
 *
 *   <Bullets title="What it buys you">
 *
 *   - one file per deck
 *   - one source for both modes
 *
 *   </Bullets>
 *
 * The list is kept to a readable measure and centred in the room under the
 * title, and, like `Cover`, the layout measures the stage so the two bands
 * spread over the slide's full height.
 */
export function Bullets({ title, lead, children, className }: BulletsProps) {
  const { ref, height } = useStageBox<HTMLElement>()

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
        <p className="mx-auto mt-[-1em] max-w-[50em] text-center text-[1em] text-sd-muted">
          {lead}
        </p>
      )}
      <div className="mx-auto flex w-full max-w-[46em] flex-1 items-center text-[1.1em] leading-snug [&_li+li]:mt-[0.5em] [&_li::marker]:text-sd-accent [&_ul]:my-0">
        {children}
      </div>
    </main>
  )
}

export default Bullets
