import type { ReactNode } from 'react'

/** A picture a deck file imported. Vite hands a URL back and Astro's asset
 * pipeline an object with the URL inside, so both are taken. */
export type FigureSource = string | { src: string }

export interface FigureProps {
  /** The picture an `import` resolved, or its URL. */
  src: FigureSource
  /** What the picture shows, for a reader who cannot see it (N1). */
  alt: string
  /** A line under the picture — its source, or what to look at. */
  caption?: ReactNode
  className?: string
}

/** The URL of a picture, however the host's bundler handed it over. */
function urlOf(source: FigureSource): string {
  return typeof source === 'string' ? source : source.src
}

/**
 * A picture on a slide (R5).
 *
 * It is a `Figure`, not a bare `<img>`, for three reasons that matter inside a
 * deck: it fills the column it is in and keeps its proportions, it is capped
 * at a height measured in the deck's own units so a tall picture cannot push
 * the slide out of its box (nothing about a slide scrolls), and it carries an
 * `alt` and an optional caption so the picture is not lost to a reader who
 * cannot see it.
 *
 * It composes with `Columns`, `Grid` and `Stack`, which is what makes the
 * text-and-picture layouts: a picture on its own in one column, or a figure
 * among the blocks of a grid.
 */
export function Figure({ src, alt, caption, className }: FigureProps) {
  return (
    <figure className={`m-0 flex w-full flex-col items-center gap-[0.5em] ${className ?? ''}`}>
      <img
        src={urlOf(src)}
        alt={alt}
        className="block h-auto max-h-[40cqi] w-full rounded-[0.5em] object-contain"
      />
      {caption !== undefined && (
        <figcaption className="text-center text-[0.75em] leading-snug text-sd-muted">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

export default Figure
