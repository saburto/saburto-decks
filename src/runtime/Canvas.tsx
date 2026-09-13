import { useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { SlideContext, SlideNumberContext } from './Slide'

export interface CanvasProps {
  /** The artboard's width in its own coordinates. */
  width?: number
  /** The artboard's height in its own coordinates. */
  height?: number
  children?: ReactNode
}

/**
 * A fixed-size artboard (R5).
 *
 * The deck's slides are normally a column of text that reflows and shrinks to
 * fit. Some layouts — the original infodeck's cover, for one — are drawn on a
 * fixed board instead, with absolutely positioned blocks, and the board is
 * scaled as a whole so nothing reflows. `Canvas` is that board: it takes the
 * stage, puts its children in a `width`×`height` coordinate space, and scales
 * the space uniformly to fit the room the deck has.
 *
 * The board is portalled into the stage rather than left inside the slide. A
 * slide carries the entrance animation, whose `transform` makes it the
 * containing block for an absolutely positioned child; the board has to size
 * against the stage instead. Only the slide the reader is on draws its board,
 * so the stage holds one at a time.
 */
export function Canvas({ width = 960, height = 590, children }: CanvasProps) {
  const { index, refresh } = useContext(SlideContext)
  const position = useContext(SlideNumberContext)
  const here = useRef<HTMLSpanElement | null>(null)
  const [stage, setStage] = useState<HTMLElement | null>(null)
  const [scale, setScale] = useState(1)

  /* Where the board belongs: the stage around this slide, found even while the
     slide itself is hidden. */
  useLayoutEffect(() => {
    setStage(here.current?.closest<HTMLElement>('.stage') ?? null)
  }, [])

  useLayoutEffect(() => {
    if (!stage) return

    const fit = () => {
      const style = getComputedStyle(stage)
      const room = {
        width: stage.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight),
        height: stage.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom)
      }
      if (room.width > 0 && room.height > 0) setScale(Math.min(room.width / width, room.height / height))
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [stage, width, height, refresh])

  const anchor = <span ref={here} hidden />

  if (position !== index || !stage) return anchor

  return (
    <>
      {anchor}
      {createPortal(
        <div className="sd-canvas absolute inset-0 grid place-items-center">
          {/* The outer box is the scaled size, so it centres like any other
              box; the inner board is the real coordinate space, scaled from
              its corner to fill the outer box exactly. */}
          <div className="relative" style={{ width: width * scale, height: height * scale }}>
            <div
              className="absolute left-0 top-0 origin-top-left text-[15px] leading-[1.2]"
              style={{ width, height, transform: `scale(${scale})` }}
            >
              {children}
            </div>
          </div>
        </div>,
        stage
      )}
    </>
  )
}

export default Canvas
