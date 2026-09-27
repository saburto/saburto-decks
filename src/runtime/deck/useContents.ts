/**
 * The deck's table of contents, as far as the deck's chrome is concerned
 * (R17, R22): whether it is open, where its panel is, and the control that
 * opens it.
 *
 * The entries themselves are `../Contents`, and are built from the deck's
 * slides; this hook only owns the sidebar's state and the one rule that makes
 * it keyboard-friendly: opening it puts focus on the entry for the slide the
 * reader is on, and dismissing it puts focus back on the control that opened
 * it — or on the deck itself, when the controls are hidden — so the keyboard
 * never drops out of the deck (N1).
 */
import { useCallback, useRef, useState, type RefObject } from 'react'
import { useIsomorphicLayoutEffect } from './dom'

export interface ContentsOptions {
  /** The slide the reader is on: the entry to focus when the contents open. */
  indexRef: RefObject<number>
  /** Where focus goes on dismissal when there is no control to return to —
   * the deck with its controls hidden (R22). */
  hostRef?: RefObject<HTMLElement | null>
}

export interface Contents {
  open: boolean
  /** Whether it is open, readable from a callback that must not go stale. */
  openRef: RefObject<boolean>
  panelRef: RefObject<HTMLDivElement | null>
  buttonRef: RefObject<HTMLButtonElement | null>
  openPanel: () => void
  close: () => void
  toggle: () => void
}

export function useContents({ indexRef, hostRef }: ContentsOptions): Contents {
  const [open, setOpen] = useState(false)
  const openRef = useRef(open)
  openRef.current = open

  const panelRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const openPanel = useCallback(() => setOpen(true), [])

  /* Dismissing returns focus to the control that opened the contents, so the
     keyboard never drops out of the deck (N1). With the controls hidden there
     is no such control, so the deck itself takes focus. */
  const close = useCallback(() => {
    setOpen(false)
    const back = buttonRef.current ?? hostRef?.current
    back?.focus({ preventScroll: true })
  }, [hostRef])

  const toggle = useCallback(() => setOpen((current) => !current), [])

  /* Opening puts focus on the entry for the slide the reader is on — the
     keyboard goes straight to where they are (R17, N1). The slide's own
     second-level entries are skipped: the slide is the reader's place. The
     entry is brought into the list's view, so a reader opening the contents
     from the far end of a long deck sees where they are; only the list
     scrolls, never the slide (R17). */
  useIsomorphicLayoutEffect(() => {
    if (!open) return
    const entries = panelRef.current?.querySelectorAll<HTMLElement>('[data-toc-slide]')
    if (!entries?.length) return
    const current = entries[indexRef.current] ?? entries[0]
    current?.focus({ preventScroll: true })

    const list = panelRef.current?.querySelector<HTMLElement>('.contents-list')
    if (!list || !current) return
    const listBox = list.getBoundingClientRect()
    const entryBox = current.getBoundingClientRect()
    list.scrollTop += entryBox.top - listBox.top - (listBox.height - entryBox.height) / 2
  }, [open, indexRef])

  return { open, openRef, panelRef, buttonRef, openPanel, close, toggle }
}
