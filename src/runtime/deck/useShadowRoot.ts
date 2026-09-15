/**
 * The deck's shadow root (R8).
 *
 * The root is part of the contract — it is what keeps the host page's CSS out
 * of the deck and the deck's CSS out of the page — so it is created once and
 * the deck is portalled into it.
 */
import { useState, type RefObject } from 'react'
import { useIsomorphicLayoutEffect } from './dom'

export function useShadowRoot(hostRef: RefObject<HTMLElement | null>): ShadowRoot | null {
  const [shadow, setShadow] = useState<ShadowRoot | null>(null)

  useIsomorphicLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    setShadow(host.shadowRoot ?? host.attachShadow({ mode: 'open' }))
  }, [hostRef])

  return shadow
}
