/**
 * The deck's keyboard, and the focus containment that goes with it (N1).
 *
 * The listener is native rather than React's synthetic one: it has to see keys
 * typed anywhere inside the shadow root, and the host element is outside it. It
 * only fires for keys typed while focus is inside the deck, which is exactly
 * the rule we want — embedded, the deck does not steal the page's arrow keys.
 *
 * Which key means what is `./keys`, as pure functions; this hook is only the
 * DOM around them: finding the focused element, moving focus, and calling the
 * deck back.
 */
import { useEffect, type RefObject } from 'react'
import type { DeckPosition } from './useDeckPosition'
import type { Contents } from './useContents'
import { focusableIn, wrapFocus } from './dom'
import { contentsCommand, deckCommand } from './keys'
import type { DeckMode } from '../Slide'

export interface DeckKeyboardOptions {
  hostRef: RefObject<HTMLElement | null>
  shadow: ShadowRoot | null
  position: DeckPosition
  contents: Contents
  modeRef: RefObject<DeckMode>
  /** Leaves present mode (R6). */
  onExit: () => void
}

export function useDeckKeyboard({
  hostRef,
  shadow,
  position,
  contents,
  modeRef,
  onExit
}: DeckKeyboardOptions): void {
  const { next, prev, goTo, countRef } = position
  const { openRef, panelRef, openPanel, close } = contents

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    /* Focus is only contained while presenting; embedded, Tab should be able
       to leave the deck and carry on through the page. */
    const keepFocusInside = (event: KeyboardEvent) => {
      const focusable = focusableIn(shadow)
      if (focusable.length === 0) {
        event.preventDefault()
        host.focus({ preventScroll: true })
        return
      }
      const active = shadow?.activeElement
      const at = active ? focusable.indexOf(active as HTMLElement) : -1
      const to = wrapFocus(event.shiftKey, at, focusable.length)
      if (to === null) return
      event.preventDefault()
      focusable[to]?.focus()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      /* While the contents are open they own the keyboard: the reader is
         choosing a slide, not stepping through one (R17). */
      if (openRef.current) {
        const panel = panelRef.current
        const entries = Array.from(panel?.querySelectorAll<HTMLElement>('[data-toc-entry]') ?? [])
        const buttons = focusableIn(panel)
        const active = shadow?.activeElement as HTMLElement | null
        const command = contentsCommand(
          event.key,
          active ? entries.indexOf(active) : -1,
          entries.length
        )

        switch (command.kind) {
          case 'close':
            event.preventDefault()
            close()
            return
          case 'tab': {
            /* The contents are one control: Tab stays within them until they
               are dismissed. */
            const to = wrapFocus(
              event.shiftKey,
              active ? buttons.indexOf(active) : -1,
              buttons.length
            )
            if (to === null) return
            event.preventDefault()
            buttons[to]?.focus()
            return
          }
          case 'focus':
            event.preventDefault()
            entries[command.entry]?.focus()
            return
          default:
            return
        }
      }

      const command = deckCommand(event.key, modeRef.current === 'present')

      switch (command.kind) {
        case 'exit':
          event.preventDefault()
          onExit()
          return
        case 'contents':
          event.preventDefault()
          openPanel()
          return
        case 'next':
          event.preventDefault()
          next()
          return
        case 'prev':
          event.preventDefault()
          prev()
          return
        case 'first':
          event.preventDefault()
          goTo(0)
          return
        case 'last':
          event.preventDefault()
          goTo(countRef.current - 1)
          return
        case 'tab':
          if (modeRef.current === 'present') keepFocusInside(event)
          return
        default:
          return
      }
    }

    host.addEventListener('keydown', onKeyDown)
    return () => host.removeEventListener('keydown', onKeyDown)
  }, [
    hostRef,
    shadow,
    next,
    prev,
    goTo,
    countRef,
    openRef,
    panelRef,
    openPanel,
    close,
    modeRef,
    onExit
  ])
}
