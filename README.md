# saburto-decks

Author a slide deck once in MDX, then use it two ways: **embedded** in a page, showing one slide
at a time in a box the page provides, and **presented full screen** from the same file. No second
copy, no audience-facing slides-plus-article.

A deck is a React component. Embedding one is importing a component and rendering it, whether the
host page is an Astro site or a plain React app.

> **Status: walking skeleton.** The whole path works end to end — authoring, compiling, embedding,
> presenting, and returning the reader to their place — with a deliberately narrow feature set.
> [PLAN.md](PLAN.md) holds the requirements, including what "done" means for this version.

## Quick start

```bash
bun install
bun run build     # the library, then both demo hosts
bun run demo      # → http://127.0.0.1:4173/  (the Astro host)
bun run dev       # the Astro host with hot reload
bun run dev:react # the React host with hot reload
```

Two demo hosts are in this repository, deliberately: `demo/` is an **Astro** site, `react-demo/`
is a **plain React app**, and both embed the same deck from `decks/example.mdx`.

## Writing a deck

A deck is one MDX file. A slide ends at a line containing only `---`:

```mdx
---
title: Saburto Decks
---

# A deck title

Body text, with **emphasis**, `inline code` and [links](https://example.com).

---

## Slide two

- a list
- of items

---

Slide three.
```

`---` is ordinary Markdown, so the file stays readable in any editor. Frontmatter's own `---` are
parsed first, so they never split a slide. A slide may contain headings, paragraphs, lists, links,
emphasis and inline code (R3); anything MDX can render will work, but nothing else is promised.

The deck's frontmatter `title` is available to the host as `frontmatter` from the same import.

## Embedding a deck

### In Astro

```bash
astro add react            # a deck is a React component
bun add @saburto/saburto-decks
```

```ts
// astro.config.ts
import react from '@astrojs/react'
import { saburtoDecks } from '@saburto/saburto-decks/mdx'

export default defineConfig({
  integrations: [react()],
  vite: { plugins: [saburtoDecks()] }   // compiles every .mdx deck to a React component
})
```

```astro
---
// src/pages/blog/post.astro
import Deck from '@saburto/saburto-decks'
import slides from '../../decks/my-deck.mdx'
---

<BlogPostLayout>
  <p>Article text above the deck.</p>

  <Deck slides={slides} client:load />

  <p>Article text below it.</p>
</BlogPostLayout>
```

Astro's own MDX integration is **not** what you want here, and adding it would not help: it
compiles MDX to Astro components, and a deck is a React component. `saburtoDecks()` brings the MDX
pipeline a deck needs, with the remark plugins that make `---` mean "next slide".

### In a React app

```tsx
import { Deck } from '@saburto/saburto-decks'
import slides from './my-deck.mdx'

export default function Post() {
  return (
    <>
      <p>Article text above the deck.</p>
      <Deck slides={slides} />
      <p>Article text below it.</p>
    </>
  )
}
```

```ts
// vite.config.ts
import { saburtoDecks } from '@saburto/saburto-decks/mdx'

export default defineConfig({ plugins: [saburtoDecks()] })
```

React is a peer dependency: the host's React is used, and a deck never carries a second copy.

## Props

| Prop | Type | Notes |
| --- | --- | --- |
| `slides` | React component | the compiled deck: `import slides from './my-deck.mdx'` |
| `defaultSlide` | `number` | which slide to start on |
| `theme` | `'light' \| 'dark' \| 'system'` | the host decides; the deck never guesses |
| `onSlideChange` | `(index, count) => void` | told when the slide changes |
| `onModeChange` | `(mode) => void` | told when the deck enters or leaves present mode |

Anything else — `id`, `className`, `style`, `aria-label`, `data-*` — goes to the deck's element in
the page, so the host can lay it out like any other block.

## Driving a deck from the host

A ref exposes what a host page's own logic needs: a route change, a keyboard shortcut, a control
of its own.

```tsx
const deck = useRef<DeckHandle>(null)

<button onClick={() => deck.current?.present()}>Present</button>
<Deck ref={deck} slides={slides} />

deck.current?.goTo(2)      // 0-based, clamped
deck.current?.next()       // also prev(), exitPresent()
```

Note that while a deck is presenting it covers the page, so the host's own buttons are underneath
it: `exitPresent()` from the host's code is how a host ends a presentation itself. The reader can
always leave with `Esc`, or with the deck's own exit control.

## Sizing and theming

The deck fills its container's width and is 16:9 by default. Its type is sized to *its own box*,
not to the page or the viewport — 1cqi is 1% of the deck's width — and is shrunk further if a
slide would not otherwise fit. **A slide is never scrolled**: it is scaled to fit instead.

The host page has the last word on both:

```css
#my-deck { --sd-aspect: 4 / 3 }        /* a squarer box */
#my-deck { width: 30rem }              /* the type follows the box */
#my-deck { --sd-bg: #fffdf5; --sd-accent: #b45309 }
```

| Variable | Use |
| --- | --- |
| `--sd-aspect` | the deck's shape; `auto` to let the host's own `height` decide |
| `--sd-bg` | deck background |
| `--sd-fg` | body text |
| `--sd-muted` | counter and secondary text |
| `--sd-border` | hairlines |
| `--sd-accent` | links |
| `--sd-surface` | inline code and buttons |

## Keyboard

| Key | Embedded (once the deck has focus) | Presenting |
| --- | --- | --- |
| `→` `↓` `PageDown` `Space` | next slide | next slide |
| `←` `↑` `PageUp` | previous slide | previous slide |
| `Home` / `End` | first / last slide | first / last slide |
| `Esc` | — | leave present mode |
| `Tab` | moves on through the page | cycles within the deck |

The deck takes the keyboard **only while it has focus**; click it, or Tab to it. Everywhere else
the page scrolls normally. While presenting, focus is contained and returned on exit, and
`prefers-reduced-motion` removes the slide transition. Slide changes are announced to screen
readers through a live region.

## Presenting, and coming back

Present mode is a fixed overlay from the deck's own shadow tree, plus the native Fullscreen API
when the browser has it. The overlay is what guarantees a full-screen presentation; fullscreen
only removes the browser chrome, so present mode does not depend on it being available or
permitted.

Leaving present mode puts the deck back on the slide it was on, with the page still scrolled
exactly where you left it. The host element keeps its place in the page's flow while presenting,
so the page's height never changes.

## Isolation

The deck renders inside a shadow root with `all: initial` on its host, so:

- the host page's CSS does not reach into the deck, even hostile rules aimed straight at `h1`,
  `p`, `section` and `button`;
- the deck's CSS does not leak out: a host page looks the same with and without a deck embedded;
- both directions are asserted by the test suite, in both demo hosts.

One consequence worth knowing: because the deck lives in a shadow root, its slides are **not** in
the server-rendered HTML. A page that needs the deck's text for search engines or for readers
without JavaScript would need a different trade-off.

## Tests

```bash
bun run verify      # typecheck → unit → build → e2e
bun run test        # unit tests (Bun): the slide splitter, and a real MDX compile
bun run test:e2e    # end-to-end tests (Playwright) against the built demo sites
```

The end-to-end suite drives both demo hosts in a real browser and covers embedded mode, present
mode, isolation in both directions, host control, keyboard behaviour, focus containment, reduced
motion, the no-Fullscreen-API path, and place restoration. `bun run test:e2e --headed` watches it
work.

## Requirements

[PLAN.md](PLAN.md) is the requirements document — what the deck must do, and when this version is
finished. This README describes how to use it; where the two could disagree, PLAN.md decides. The
end-to-end tests name the requirement each one covers, so the two can be read side by side.
