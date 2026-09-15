/**
 * How much room a layout has on its slide (R5).
 *
 * A layout that places its content in bands — a title at the top, a grid under
 * it — has to know the height of the stage, or the bands float in the middle
 * of the slide instead of using it. Measuring the stage rather than the slide
 * is what makes this work for a slide that is not on screen yet: the slides
 * that are not the reader's are `display: none`, and measure zero, while the
 * stage is always laid out.
 *
 * The measurement follows the stage with a `ResizeObserver`, so a host that
 * resizes the deck's box gets a layout that fits the new box, and it is
 * retaken when `refresh` says content arrived late — a diagram Mermaid drew
 * (R13).
 */
import { useContext, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { SlideContext } from './Slide'

export interface StageHeight<T extends HTMLElement> {
  /** Attached to the layout's root, so the stage around it can be found. */
  ref: RefObject<T | null>
  /** The stage's content height, once measured. */
  height: number | undefined
}

/** Measures room for a layout: the stage's height, its padding excluded. */
export function useStageHeight<T extends HTMLElement = HTMLElement>(): StageHeight<T> {
  const { refresh } = useContext(SlideContext)
  const ref = useRef<T | null>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    const stage = ref.current?.closest<HTMLElement>('.stage')
    if (!stage) return

    const fit = () => {
      const style = getComputedStyle(stage)
      /* Rounded down: `scrollHeight`, which the deck measures a slide by, is a
         whole number, so a fractional minimum can report one pixel more room
         than the stage has and make a slide impossible to fit at any size. */
      setHeight(
        Math.floor(
          stage.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom)
        )
      )
      /* The deck fits the type against the height this layout had when it
         last rendered. A box that just changed may have left it fitting
         against the old one, so ask it to look again now that the new height
         is known. Without this a layout can hold a stale, too-large minimum
         during a resize, and the deck can shrink its type all the way to
         nothing trying to fit a slide that no longer has to be that tall. */
      refresh()
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [refresh])

  return { ref, height }
}

export default useStageHeight
