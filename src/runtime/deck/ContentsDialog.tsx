/**
 * The deck's table of contents as an overlay (R17).
 *
 * The same list as the `<Contents />` an author puts on a slide, over the
 * stage rather than over the whole deck, so the bar — and the control that
 * opened them — stays put. It is a control, not slide content, so a long list
 * may scroll where a slide never would.
 *
 * It is presentational: the entries come from `SlideContext`, and opening,
 * dismissing and moving focus are the caller's — which is what lets the panel
 * be rendered and asserted on with a context of its own.
 */
import type { RefObject } from 'react'
import { ContentsEntries } from '../Contents'

export interface ContentsDialogProps {
  /** The panel, for the keyboard to find its entries and buttons. */
  panelRef?: RefObject<HTMLDivElement | null>
  /** Dismissed by the reader: Escape, the close control, or a click outside. */
  onClose: () => void
}

export function ContentsDialog({ panelRef, onClose }: ContentsDialogProps) {
  return (
    <div
      className="contents absolute inset-0 z-[1] flex items-center justify-center p-2 text-[clamp(0.75rem,1.7cqi,1.05rem)] bg-[color-mix(in_srgb,var(--sd-bg)_85%,transparent)]"
      role="dialog"
      aria-modal="true"
      aria-label="Table of contents"
      ref={panelRef}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="contents-panel flex flex-col w-[min(100%,30em)] max-h-full px-[1em] pt-[0.8em] pb-[0.9em] text-sd-fg bg-sd-bg border border-sd-border rounded-[0.6em] shadow-[0_0.5em_2em_rgba(0,0,0,0.18)]">
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

export default ContentsDialog
