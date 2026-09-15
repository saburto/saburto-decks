import { type ReactNode } from 'react'
import { useStageBox } from './stage'

export interface StageProps {
  /** The page: laid out in the box with ordinary CSS — flex, grid, or nothing. */
  children?: ReactNode
  className?: string
}

/**
 * The deck's own box, handed to a slide (R21).
 *
 * A slide is normally a column of text the deck centres in its box and fits.
 * That is the right shape for a passage, and the wrong one for a page: a
 * layout that wants the whole room — a title at the top, columns that reach
 * the edges, a foot at the bottom — cannot get it from the inside, because
 * the slide's own box is out of the author's reach.
 *
 * This is that room, measured: the width and height the deck has for a slide,
 * at the size the host gave it. Inside it a slide is ordinary CSS. Two things
 * still hold, and are the reasons the box is measured rather than described:
 * the box follows the deck's box when the host resizes it, and it takes part in
 * fitting, so a page whose content is too big gets a smaller type rather than a
 * scroll (R5).
 *
 * The box is the stage's room, which is wider than the measure a slide keeps
 * its text to, so it is centred on the slide rather than laid out inside it —
 * the one thing here that is not plain CSS, and the reason the width is
 * measured rather than left to `width: 100%`.
 *
 * Like `Cover`, `Agenda`, `Columns` and `Grid`, it spreads over the whole
 * stage, so one of them is a slide's content: whatever else a slide holds goes
 * inside it.
 */
export function Stage({ children, className }: StageProps) {
  const { ref, width, height } = useStageBox<HTMLElement>()

  return (
    <main
      ref={ref}
      className={className}
      /* Until the stage has been measured there is no box to lay out in; the
         slide is then whatever its content is, and the measurement lands in
         the same commit, before the browser paints. */
      style={
        width === undefined || height === undefined
          ? undefined
          : {
              width,
              height,
              position: 'relative',
              left: '50%',
              marginInline: -width / 2
            }
      }
    >
      {children}
    </main>
  )
}

export default Stage
