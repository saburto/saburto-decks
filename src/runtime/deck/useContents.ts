/**
 * The deck's table of contents, as far as the deck's chrome is concerned
 * (R17): whether it is open, where its panel is, and the control that opens
 * it.
 *
 * The entries themselves are `../Contents`, and are built from the deck's
 * slides; this hook only owns the overlay's state and the one rule that makes
 * it keyboard-friendly: opening it puts focus on the entry for the slide the
 * reader is on, and dismissing it puts focus back on the control that opened
 * it, so the keyboard never drops out of the deck (N1).
 */
import { useCallback, useRef, useState, type RefObject } from 'react'
import { useIsomorphicLayoutEffect } from './dom'

export interface ContentsOptions {
  /** The slide the reader is on: the entry to focus when the contents open. */
  indexRef: RefObject<number>
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

export function useContents({ indexRef }: ContentsOptions): Contents {
  const [open, setOpen] = useState(false)
  const openRef = useRef(open)
  openRef.current = open

  const panelRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const openPanel = useCallback(() => setOpen(true), [])

  /* Dismissing returns focus to the control that opened the contents, so the
     keyboard never drops out of the deck (N1). */
  const close = useCallback(() => {
    setOpen(false)
    buttonRef.current?.focus({ preventScroll: true })
  }, [])

  const toggle = useCallback(() => setOpen((current) => !current), [])

  /* Opening puts focus on the entry for the slide the reader is on — the
     keyboard goes straight to where they are (R17, N1). */
  useIsomorphicLayoutEffect(() => {
    if (!open) return
    const entries = panelRef.current?.querySelectorAll<HTMLElement>('[data-toc-entry]')
    if (!entries?.length) return
    ;(entries[indexRef.current] ?? entries[0])?.focus({ preventScroll: true })
  }, [open, indexRef])

  return { open, openRef, panelRef, buttonRef, openPanel, close, toggle }
}
