/**
 * Sizing a slide to its box (R5): the type gives way, never the scroll.
 *
 * Nothing about a slide scrolls — a deck that had to be scrolled would not be
 * a deck — so the type shrinks until the current slide fits the deck's box,
 * and any slide fits any box. The search for that size is `fitFontSize`, which
 * is a pure function of "does this size fit?" and so has its own test; the
 * rest of the hook is the measuring around it.
 *
 * The hook also owns where a diagram is built and measured. Mermaid needs a
 * real element in the document to lay a diagram out, so the deck keeps one
 * fixed, invisible container sized to the deck's box (R13); a page that
 * resizes the deck's box resizes that container with it.
 */
import { useCallback, useEffect, useState, type RefObject } from 'react'
import { useIsomorphicLayoutEffect } from './dom'

/**
 * The largest type size at which the content still fits, found by bisection.
 *
 * A single correction does not do it: a run of text grows with the square of
 * the size, while a diagram in a column may be capped by that column and not
 * grow at all, so no one curve fits every slide. Bisection measures the real
 * height at each size and keeps the largest that fits.
 */
export function fitFontSize(start: number, fits: (size: number) => boolean, passes = 14): number {
  let low = 0
  let high = start
  for (let pass = 0; pass < passes; pass++) {
    const middle = (low + high) / 2
    if (fits(middle)) low = middle
    else high = middle
  }
  return low
}

export interface StageLayoutOptions {
  hostRef: RefObject<HTMLElement | null>
  shadow: ShadowRoot | null
}

export interface StageLayout {
  /** Where a diagram may be built and measured, off the host page's flow. */
  measure: HTMLElement | null
  /** Shrinks the current slide's type until it fits the deck's box. */
  fit: () => void
}

export function useStageLayout({ hostRef, shadow }: StageLayoutOptions): StageLayout {
  const [measure, setMeasure] = useState<HTMLElement | null>(null)

  /* Where Mermaid builds and measures a diagram. It has to live in the light
     DOM — Mermaid finds it by id, which does not cross a shadow boundary —
     but it is fixed and invisible, so measuring a diagram never adds height to
     the host page and never shifts where the reader is (R7, R13). */
  useIsomorphicLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const container = document.createElement('div')
    container.setAttribute('aria-hidden', 'true')
    container.style.cssText = `position: fixed; top: 0; left: 0; overflow: hidden; opacity: 0; pointer-events: none; width: ${host.clientWidth}px; height: ${host.clientHeight}px;`
    document.body.append(container)
    setMeasure(container)
    return () => container.remove()
  }, [hostRef])

  const fit = useCallback(() => {
    const stage = shadow?.querySelector<HTMLElement>('.stage')
    const slide = stage?.querySelector<HTMLElement>('section.slide[data-active]')
    if (!stage || !slide) return

    stage.style.removeProperty('font-size')
    const computed = getComputedStyle(stage)
    const room =
      stage.clientHeight -
      Number.parseFloat(computed.paddingTop) -
      Number.parseFloat(computed.paddingBottom)
    const start = Number.parseFloat(computed.fontSize)
    if (!(room > 0) || !(start > 0)) return
    if (slide.scrollHeight <= room) return

    const size = fitFontSize(start, (candidate) => {
      stage.style.fontSize = `${candidate}px`
      return slide.scrollHeight <= room
    })
    stage.style.fontSize = `${size}px`
  }, [shadow])

  /* A host page can resize the deck's box at any time. The measuring container
     follows it, so a diagram is laid out at the deck's own size. */
  useEffect(() => {
    const box = shadow?.querySelector('.deck')
    if (!box) return
    const follow = () => {
      const host = hostRef.current
      if (measure && host) {
        measure.style.width = `${host.clientWidth}px`
        measure.style.height = `${host.clientHeight}px`
      }
      fit()
    }
    const observer = new ResizeObserver(follow)
    observer.observe(box)
    return () => observer.disconnect()
  }, [shadow, fit, measure, hostRef])

  return { measure, fit }
}
