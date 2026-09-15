/**
 * Small DOM helpers the deck's internals share, and the two rules behind them
 * that can be reasoned about on their own.
 *
 * The deck is server-rendered by its host and hydrated in the browser, so a
 * layout effect is not always available; and focus is contained while
 * presenting but not while embedded (N1). Both are decisions a test can make
 * without a browser, so the decision lives here and the DOM call is made by
 * the caller.
 */
import { useEffect, useLayoutEffect } from 'react'

/** The deck is server-rendered by Astro and hydrated on the client. Layout
 * effects only exist in a browser, so fall back to `useEffect` where there is
 * no DOM to lay out. */
export const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** Everything focusable inside an element, skipping what `inert` hides. */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

export function focusableIn(root: ParentNode | null | undefined): HTMLElement[] {
  return Array.from(root?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
    (element) => !element.closest('[inert]')
  )
}

/**
 * Where Tab should carry focus instead of leaving `count` focusable elements,
 * or `null` when the browser's own order is right.
 *
 * `active` is the focused element's index, or -1 when nothing inside holds
 * focus (the host element itself does). Focus wraps in both directions, so a
 * presenting deck never loses the keyboard to the page behind it (N1).
 */
export function wrapFocus(shiftKey: boolean, active: number, count: number): number | null {
  if (count <= 0) return null
  const last = count - 1
  if (shiftKey && (active <= 0 || active === -1)) return last
  if (!shiftKey && (active === last || active === -1)) return 0
  return null
}
