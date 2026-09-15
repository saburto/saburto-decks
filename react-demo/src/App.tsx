import { useCallback, useEffect, useRef, useState } from 'react'
import { Deck, type DeckHandle, type DeckMode, type DeckTheme } from '../../src/index.ts'
import slides from '../../decks/example.mdx'

const THEMES: DeckTheme[] = ['light', 'dark', 'system']

/**
 * A simple React page with a deck in it.
 *
 * No Astro, no island directives, no build tricks: the same component and the
 * same deck file as the Astro demo, in a page that has never heard of either.
 */
export default function App() {
  const deck = useRef<DeckHandle>(null)
  const [theme, setTheme] = useState<DeckTheme>('light')
  const [mode, setMode] = useState<DeckMode>('embedded')
  const [at, setAt] = useState('')
  const [step, setStep] = useState('')

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
    <main className="wrap">
      <h1>A React page</h1>

      <p>
        This page is a plain React app. The deck below is the same component and the same deck file
        the Astro demo uses — embedding a deck is importing a component.
      </p>

      <section>
        <h2>Host content under hostile styles</h2>
        <p>
          These rules are deliberately loud: crimson headings, wavy underlines, dashed borders,
          Comic Sans. The deck below must be completely unaffected by them.
        </p>
      </section>

      <div className="controls">
        <button
          type="button"
          id="present"
          onClick={() =>
            mode === 'present' ? deck.current?.exitPresent() : deck.current?.present()
          }
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

      <p>Host content continues after the deck, unchanged.</p>
    </main>
  )
}
