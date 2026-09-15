/**
 * Present mode (R6, R7, R9): taking the screen, and giving it back exactly as
 * it was.
 *
 * Native fullscreen is a bonus, not a requirement: where the browser has it,
 * it hides the browser's own chrome; where it is missing, refused, or exited
 * by the browser (Escape, or a tablet's Done button), the deck's fixed overlay
 * is already a full-screen presentation (R9). Either way, the page is put back
 * at the offset and focus it had (R7).
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { DeckMode } from '../Slide'

const noop = () => {}

export interface PresentModeOptions {
  hostRef: RefObject<HTMLElement | null>
  onModeChange?: (mode: DeckMode) => void
}

export interface PresentMode {
  mode: DeckMode
  /** The mode, readable from a callback that must not go stale. */
  modeRef: RefObject<DeckMode>
  present: () => void
  exitPresent: () => void
}

export function usePresentMode({ hostRef, onModeChange }: PresentModeOptions): PresentMode {
  const [mode, setMode] = useState<DeckMode>('embedded')
  const modeRef = useRef<DeckMode>(mode)
  modeRef.current = mode

  /* Where the reader was, captured before present mode disturbs anything. */
  const place = useRef({ scrollY: 0, overflow: '', focus: null as HTMLElement | null })
  const holdsFullscreen = useRef(false)
  const changeMode = useRef(onModeChange)
  changeMode.current = onModeChange

  /**
   * Puts the page back at the offset it was at.
   *
   * Native fullscreen tears down asynchronously: for a frame or two the page
   * still reports no scrollable height and silently clamps whatever offset we
   * ask for. So keep asking, briefly, until the page can honour it — and then
   * stop, rather than fighting the reader for control of their own page.
   */
  const restoreScroll = useCallback((target: number, frames = 12) => {
    if (window.scrollY === target) return
    window.scrollTo(0, target)
    if (window.scrollY === target || frames <= 0) return
    requestAnimationFrame(() => restoreScroll(target, frames - 1))
  }, [])

  const present = useCallback(() => {
    if (modeRef.current === 'present') return

    /* Read before anything about the layout changes: native fullscreen makes
       the document unscrollable and clamps the offset to 0 while it lasts. */
    place.current = {
      scrollY: window.scrollY,
      overflow: document.documentElement.style.overflow,
      focus: document.activeElement instanceof HTMLElement ? document.activeElement : null
    }

    modeRef.current = 'present'
    setMode('present')
    changeMode.current?.('present')

    document.documentElement.style.overflow = 'hidden'
    const host = hostRef.current
    host?.focus({ preventScroll: true })

    host
      ?.requestFullscreen?.({ navigationUI: 'hide' })
      .then(() => {
        if (modeRef.current === 'present') holdsFullscreen.current = true
      })
      .catch(noop)
  }, [hostRef])

  const exitPresent = useCallback(() => {
    if (modeRef.current !== 'present') return

    modeRef.current = 'embedded'
    setMode('embedded')
    changeMode.current?.('embedded')

    if (holdsFullscreen.current || document.fullscreenElement === hostRef.current) {
      holdsFullscreen.current = false
      void document.exitFullscreen().catch(noop)
    }

    document.documentElement.style.overflow = place.current.overflow
    restoreScroll(place.current.scrollY)
    place.current.focus?.focus({ preventScroll: true })
  }, [hostRef, restoreScroll])

  /* The browser leaves fullscreen on its own for Escape and on tablets for the
     Done button; leaving fullscreen therefore means leaving present mode. */
  useEffect(() => {
    if (mode !== 'present') return
    const onChange = () => {
      if (!document.fullscreenElement) exitPresent()
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [mode, exitPresent])

  return { mode, modeRef, present, exitPresent }
}
