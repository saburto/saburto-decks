import { useCallback, useEffect, useRef, useState } from 'react'
import { Deck, type DeckHandle, type DeckMode, type DeckTheme } from '../../../src/index.ts'
import slides from '../../../decks/example.mdx'

const THEMES: DeckTheme[] = ['light', 'dark', 'system']

/**
 * The Astro page's interactive part: a deck, driven by the page.
 *
 * An island, because a deck is interactive. Everything here is what a host
 * page does with a deck — nothing about the deck's internals.
 */
export default function DeckDemo() {
  const deck = useRef<DeckHandle>(null)
  const [theme, setTheme] = useState<DeckTheme>('light')
  const [mode, setMode] = useState<DeckMode>('embedded')
  const [at, setAt] = useState('')
  const [step, setStep] = useState('')

  /* The page follows the same choice the deck is given, so the two agree. */
  useEffect(() => {
    document.documentElement.dataset['theme'] = theme
  }, [theme])

  /* What a host page's own logic calls — a route change, a shortcut, a control
     of its own. While the deck is presenting it covers the page, so this is
     the only way the host itself can end a presentation. */
  useEffect(() => {
    ;(window as unknown as { deck?: DeckHandle }).deck = deck.current ?? undefined
  })

  const onSlideChange = useCallback((index: number, count: number) => {
    setAt(`${index + 1}/${count}`)
  }, [])

  const onStepChange = useCallback((index: number, count: number) => {
    setStep(count > 1 ? `${index + 1}/${count}` : '')
  }, [])

  const onModeChange = useCallback((next: DeckMode) => {
    setMode(next)
  }, [])

  return (
    <div className="deck-demo">
      <div className="controls">
        <button
          type="button"
          id="present"
          onClick={() => (mode === 'present' ? deck.current?.exitPresent() : deck.current?.present())}
        >
          {mode === 'present' ? 'Exit, from the host' : 'Present, from the host'}
        </button>

        <output id="status">
          {mode}
          {at ? ` · slide ${at}` : ''}
          {step ? ` · step ${step}` : ''}
        </output>

        <div className="theme" role="group" aria-label="Theme">
          {THEMES.map((name) => (
            <button
              key={name}
              type="button"
              data-theme={name}
              aria-pressed={theme === name}
              onClick={() => setTheme(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <Deck
        id="deck"
        ref={deck}
        slides={slides}
        theme={theme}
        onSlideChange={onSlideChange}
        onStepChange={onStepChange}
        onModeChange={onModeChange}
      />
    </div>
  )
}
