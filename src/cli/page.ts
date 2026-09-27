/**
 * The page the command serves (R23).
 *
 * Two strings and no server: the HTML the browser is given, and the module it
 * loads. The module is the smallest host page there is — a React root that
 * renders `<Deck>` in the whole window and a theme switch beside it — so what
 * the command shows is the same component a page embeds, and nothing about the
 * deck is re-implemented here.
 *
 * Kept apart from the server so both strings can be read, and tested, without
 * starting one.
 */
import type { DeckTheme } from '../runtime/Slide'

/** The URL the page's entry module is served under, by the server's plugin. */
export const ENTRY_MODULE = '/@saburto-decks/page.jsx'

/** Where the page remembers the reader's theme. The slide is kept in the hash. */
export const THEME_KEY = 'saburto-decks:theme'

/** The page's own stylesheet: the smallest theme a page can have. */
const PAGE_CSS = `:root {
  --page-bg: #ffffff;
  --page-fg: #16181d;
  --page-border: #d8dce3;
  --page-surface: rgb(255 255 255 / 0.82);
  color-scheme: light;
}
:root[data-theme='dark'] {
  --page-bg: #0c0e12;
  --page-fg: #e8eaed;
  --page-border: #2c313a;
  --page-surface: rgb(20 23 29 / 0.82);
  color-scheme: dark;
}
@media (prefers-color-scheme: dark) {
  :root[data-theme='system'] {
    --page-bg: #0c0e12;
    --page-fg: #e8eaed;
    --page-border: #2c313a;
    --page-surface: rgb(20 23 29 / 0.82);
    color-scheme: dark;
  }
}
html,
body {
  margin: 0;
  height: 100%;
  overflow: hidden;
  background: var(--page-bg);
  color: var(--page-fg);
}
#root {
  height: 100dvh;
}
.themes {
  position: fixed;
  right: 0.75rem;
  bottom: 0.75rem;
  z-index: 20;
  display: flex;
  gap: 0.2rem;
  padding: 0.25rem;
  border: 1px solid var(--page-border);
  border-radius: 0.6rem;
  background: var(--page-surface);
  backdrop-filter: blur(6px);
  font: 500 0.75rem/1.2 ui-sans-serif, system-ui, sans-serif;
}
.themes button {
  font: inherit;
  padding: 0.35rem 0.6rem;
  border: 1px solid transparent;
  border-radius: 0.4rem;
  background: transparent;
  color: inherit;
  text-transform: capitalize;
  cursor: pointer;
}
.themes button[aria-pressed='true'] {
  border-color: var(--page-border);
  background: var(--page-bg);
}
.themes button:focus-visible {
  outline: 2px solid currentcolor;
  outline-offset: 2px;
}`

export interface PageOptions {
  /** What to call the page until the deck's own title arrives. */
  name: string
  /** The deck as Vite serves it: root-relative, and encoded. */
  deckModule: string
  /** Which theme the page starts in, before the reader's own choice. */
  theme: DeckTheme
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/* The theme is put on the page before the first paint, so a reader who chose
   dark is not shown a white page on the way in. */
function startupScript(theme: DeckTheme): string {
  return `(function () {
  var theme = ${JSON.stringify(theme)}
  try {
    var stored = window.localStorage.getItem(${JSON.stringify(THEME_KEY)})
    if (${JSON.stringify([...THEMES])}.indexOf(stored) !== -1) theme = stored
  } catch (error) {}
  document.documentElement.setAttribute('data-theme', theme)
})()`
}

const THEMES: readonly DeckTheme[] = ['light', 'dark', 'system']

export function pageHtml({ name, theme }: PageOptions): string {
  return `<!doctype html>
<html lang="en" data-theme="${theme}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(name)}</title>
    <link rel="icon" href="data:," />
    <style>
${PAGE_CSS}
    </style>
    <script>
${startupScript(theme)}
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${ENTRY_MODULE}"></script>
  </body>
</html>
`
}

/**
 * The page's entry module.
 *
 * The deck is imported the way a host imports it — the file itself — so the
 * command compiles the deck with the pipeline any host would use, and the page
 * gets the component, its shadow root and its stylesheet exactly as an
 * embedded deck does.
 *
 * The reader's slide is kept in the URL's hash, so the reload a save causes
 * puts them back on the slide they were reading.
 */
export function pageSource({ deckModule, theme }: PageOptions): string {
  return `import { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import DeckFile, { frontmatter } from ${JSON.stringify(deckModule)}
import { Deck } from '@saburto/saburto-decks'

const THEMES = ${JSON.stringify([...THEMES])}
const THEME_KEY = ${JSON.stringify(THEME_KEY)}
const START_THEME = ${JSON.stringify(theme)}

/* The slide the URL names, if the reader is arriving back on one. */
function startSlide() {
  const at = /^#slide=(\\d+)$/.exec(window.location.hash)
  return at ? Number(at[1]) - 1 : 0
}

function startTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_KEY)
    if (THEMES.indexOf(stored) !== -1) return stored
  } catch (error) {
    /* A browser that refuses storage is not a reason not to show a deck. */
  }
  return START_THEME
}

function Page() {
  const [theme, setTheme] = useState(startTheme)

  /* The deck is the page, so it starts with the keyboard: the reader can
     press an arrow key on arrival, without aiming at anything first. */
  useEffect(() => {
    document.getElementById('deck')?.focus()
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const chooseTheme = useCallback((next) => {
    setTheme(next)
    try {
      window.localStorage.setItem(THEME_KEY, next)
    } catch (error) {}
  }, [])

  const remember = useCallback((index) => {
    window.history.replaceState(null, '', '#slide=' + (index + 1))
  }, [])

  return (
    <div className="page">
      <Deck
        id="deck"
        slides={DeckFile}
        theme={theme}
        defaultSlide={startSlide()}
        onSlideChange={remember}
        style={{ aspectRatio: 'auto', height: '100dvh', width: '100%' }}
      />
      <div className="themes" role="group" aria-label="Theme">
        {THEMES.map((name) => (
          <button
            key={name}
            type="button"
            data-theme={name}
            aria-pressed={name === theme}
            onClick={() => chooseTheme(name)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}

if (frontmatter && typeof frontmatter.title === 'string') document.title = frontmatter.title

createRoot(document.getElementById('root')).render(<Page />)
`
}
