import { Children, type ReactNode } from 'react'
import { useStageHeight } from './stage'

export interface AgendaProps {
  /** The title across the top. */
  title?: ReactNode
  /** The blocks: the first two sit side by side, the rest are centred below. */
  children?: ReactNode
  className?: string
}

/**
 * An agenda layout: a title, two blocks side by side, and any further blocks
 * centred below (R5).
 *
 * It is the companion to `Cover` — the same three-band shape, but with room for
 * a few short lists rather than one passage — and it works the same way: it
 * measures the stage so the bands spread over the slide's full height, and
 * everything is sized in the deck's own units, so it scales with the deck's box
 * and with the type size the deck settles on.
 */
export function Agenda({ title, children, className }: AgendaProps) {
  const { ref: box, height } = useStageHeight<HTMLElement>()

  const blocks = Children.toArray(children).filter(
    (child) => !(typeof child === 'string' && child.trim() === '')
  )
  const top = blocks.slice(0, 2)
  const below = blocks.slice(2)

  return (
    <main
      ref={box}
      className={`flex flex-col justify-between gap-[2em] ${className ?? ''}`}
      style={height ? { minHeight: height } : undefined}
    >
      {title !== undefined && (
        <h1 className="mx-auto max-w-[44em] text-center text-[2em] font-extrabold tracking-tight text-balance">
          {title}
        </h1>
      )}

      {top.length > 0 && (
        <div className="mx-auto grid w-full max-w-[64cqi] items-start justify-items-center gap-[2em] sm:grid-cols-2">
          {top.map((block, position) => (
            <div key={position} className="w-full">
              {block}
            </div>
          ))}
        </div>
      )}

      {below.length > 0 && (
        <div className="mx-auto flex w-full max-w-[64cqi] flex-col items-center gap-[2em]">
          {below.map((block, position) => (
            <div key={position} className="w-full max-w-[36em]">
              {block}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

export default Agenda
