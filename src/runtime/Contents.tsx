import { useContext } from 'react'
import { SlideContext } from './Slide'

/**
 * The entries of the deck's table of contents (R17), shared by the sidebar the
 * reader opens from the bar and by the `<Contents />` an author puts on a
 * slide. Both are the same list, from the same source: the slides' headings,
 * read as the deck renders.
 *
 * A slide is one numbered entry, named by its own first heading, and the
 * slide's own second-level headings are listed under it.
 *
 * `labelledBy` names the heading the list belongs to, when there is one;
 * `onChoose` lets the sidebar dismiss itself once a slide has been chosen;
 * `className` is where the sidebar adds its scroll behaviour — on a slide the
 * list is content, and content never scrolls (R5).
 */
export function ContentsEntries({
  labelledBy,
  onChoose,
  className
}: {
  labelledBy?: string
  onChoose?: (position: number) => void
  className?: string
}) {
  const { index, outline, goTo } = useContext(SlideContext)

  return (
    <ol
      className={`contents-list m-0 p-0 list-none${className ? ` ${className}` : ''}`}
      aria-labelledby={labelledBy}
    >
      {outline.map((slide, position) => (
        <li key={position}>
          <button
            type="button"
            data-toc-entry=""
            data-toc-slide={position}
            className="contents-entry group flex gap-[0.7em] items-baseline w-full px-[0.5em] py-[0.3em] [font:inherit] text-start text-inherit bg-transparent border-0 rounded-[0.4em] cursor-pointer hover:bg-sd-surface aria-[current]:text-sd-accent focus-visible:outline-2 focus-visible:outline-sd-accent focus-visible:outline-offset-2"
            aria-current={position === index ? 'true' : undefined}
            onClick={() => {
              goTo(position)
              onChoose?.(position)
            }}
          >
            <span
              className="contents-number shrink-0 min-w-[1.6em] text-sd-muted [font-variant-numeric:tabular-nums] text-end group-aria-[current]:text-inherit"
              aria-hidden="true"
            >
              {position + 1}
            </span>
            <span className="contents-title grow">{slide.title}</span>
          </button>

          {slide.sections.length > 0 && (
            <ul className="contents-sections m-0 p-0 list-none">
              {slide.sections.map((section, at) => (
                <li key={at}>
                  <button
                    type="button"
                    data-toc-entry=""
                    data-toc-section=""
                    className="contents-section group flex w-full ps-[2.9em] pe-[0.5em] py-[0.25em] [font:inherit] text-start text-inherit bg-transparent border-0 rounded-[0.4em] cursor-pointer hover:bg-sd-surface focus-visible:outline-2 focus-visible:outline-sd-accent focus-visible:outline-offset-2"
                    onClick={() => {
                      goTo(position)
                      onChoose?.(position)
                    }}
                  >
                    <span className="contents-title grow text-sd-muted">{section}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  )
}

/**
 * A table of contents as slide content (R17): put `<Contents />` on a slide
 * and it lists the deck's slides, named by their headings and with their
 * second-level headings under them. Like every other slide content it is
 * measured with the slide and never scrolls — the list is scaled to fit with
 * the rest.
 */
export function Contents() {
  return (
    <nav className="sd-contents my-[0.85em]" aria-label="Table of contents">
      <ContentsEntries />
    </nav>
  )
}
