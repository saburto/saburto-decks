import { useCallback, useEffect, useRef, useState } from 'react'
import { Deck, type DeckComponent, type DeckHandle, type DeckMode, type DeckTheme } from '../../../src/index.ts'

const THEMES: DeckTheme[] = ['light', 'dark', 'system']

/**
 * A host page's interactive part: a deck, driven by the page.
 *
 * The same component is used for every deck a demo embeds — the difference
 * between two hosts is only which deck file they import. Everything here is
 * what a host page does with a deck, and nothing about the deck's internals.
 */
export default function DeckHost({ slides }: { slides: DeckComponent }) {
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
     the only way the host itself can end a presentation.

     It is a callback ref rather than an effect: the host element carries
     `id="deck"`, and until the handle is assigned the browser's named access
     makes `window.deck` the element — which has no `goTo`. Assigning during
     the commit closes that window, so a caller never reaches the element. */
  const setDeck = useCallback((node: DeckHandle | null) => {
    deck.current = node
    ;(window as unknown as { deck?: DeckHandle }).deck = node ?? undefined
  }, [])

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
        ref={setDeck}
        slides={slides}
        theme={theme}
        onSlideChange={onSlideChange}
        onStepChange={onStepChange}
        onModeChange={onModeChange}
      />
    </div>
  )
}
