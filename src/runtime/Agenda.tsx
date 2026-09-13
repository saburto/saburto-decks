import { Children, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { SlideContext } from './Slide'

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
  const { refresh } = useContext(SlideContext)
  const box = useRef<HTMLElement | null>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)

  const blocks = Children.toArray(children).filter(
    (child) => !(typeof child === 'string' && child.trim() === '')
  )
  const top = blocks.slice(0, 2)
  const below = blocks.slice(2)

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
