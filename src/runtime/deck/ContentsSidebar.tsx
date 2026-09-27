/**
 * The deck's table of contents as a sidebar (R17, R22).
 *
 * The same list as the `<Contents />` an author puts on a slide, opened over
 * the stage and anchored to its left edge. It overlays the slide rather than
 * taking room from it, so opening it changes neither the slide's layout nor
 * the type size the deck settled on. It is a control, not slide content, so a
 * long list may scroll where a slide never would.
 *
 * It is presentational: the entries come from `SlideContext`, and opening,
 * dismissing and moving focus are the caller's — which is what lets the panel
 * be rendered and asserted on with a context of its own.
 */
import type { RefObject } from 'react'
import { ContentsEntries } from '../Contents'

export interface ContentsSidebarProps {
  /** The panel, for the keyboard to find its entries and buttons. */
  panelRef?: RefObject<HTMLDivElement | null>
  /** Dismissed by the reader: Escape, the close control, or a click outside. */
  onClose: () => void
}

export function ContentsSidebar({ panelRef, onClose }: ContentsSidebarProps) {
  return (
    <div
      className="contents absolute inset-0 z-[1] flex justify-start text-[clamp(0.75rem,1.7cqi,1.05rem)] bg-[color-mix(in_srgb,var(--sd-bg)_60%,transparent)]"
      role="dialog"
      aria-modal="true"
      aria-label="Table of contents"
      ref={panelRef}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="contents-panel contents-sidebar flex flex-col h-full w-[min(100%,20em)] px-[1em] pt-[0.8em] pb-[0.9em] text-sd-fg bg-sd-bg border-r border-sd-border shadow-[0_0.5em_2em_rgba(0,0,0,0.18)]">
        <div className="contents-head flex items-baseline justify-between gap-[1em] mb-[0.4em]">
          <p
            className="contents-heading m-0 text-sd-muted text-[0.8em] font-semibold tracking-[0.08em] uppercase"
            id="sd-contents-heading"
          >
            Contents
          </p>
          <button
            type="button"
            className="contents-close px-[0.35em] py-[0.1em] [font:inherit] text-[1.1em] leading-none text-inherit bg-transparent border-0 rounded-[0.35em] cursor-pointer hover:bg-sd-surface focus-visible:outline-2 focus-visible:outline-sd-accent focus-visible:outline-offset-2"
            aria-label="Close contents"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <ContentsEntries
          labelledBy="sd-contents-heading"
          onChoose={onClose}
          className="min-h-0 overflow-auto"
        />
      </div>
    </div>
  )
}

export default ContentsSidebar
