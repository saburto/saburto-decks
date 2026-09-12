# saburto-decks

Author a slide deck once in MDX, then use it two ways: **embedded** in an existing web page,
showing one slide at a time in a box the page provides, and **presented full screen** from the
same file. No second copy, no audience-facing slides-plus-article.

Embedding a deck needs no build step, no framework and no change to the host page's tooling: a
deck is a single `.js` file plus a tag.

> **Status: walking skeleton.** The whole path works end to end — authoring, build, embedding,
> presenting, and returning the reader to their place — with a deliberately narrow feature set.
> See [Limitations](#limitations). [PLAN.md](PLAN.md) holds the requirements.

## Quick start

```bash
bun install
bun run build      # → dist/example.deck.js
bun run demo       # → http://127.0.0.1:4173/demo/
```

`HOST=0.0.0.0 bun run demo` binds to your network instead of localhost, if you want to reach the
demo from another machine.

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
emphasis and inline code ([R3](PLAN.md)); anything MDX can render will work, but nothing else is
promised.

The deck's frontmatter `title` becomes the host element's accessible label.

**Who builds what.** A deck is compiled by whoever authors it — `bun run build` turns
`decks/example.deck.ts` into `dist/example.deck.js`. The *host page* only ever loads that file.

## Embedding a deck

```html
<saburto-deck theme="system"></saburto-deck>
<script src="./example.deck.js"></script>
```

That is the whole integration. Drop the two lines in an existing HTML page and the deck appears
where you put the tag; the script may come before or after it.

- No build step, bundler or framework on the host side ([N1](PLAN.md)).
- The bundle is a classic-script IIFE with the styles inside it: one file, no separate CSS
  request, and it works straight from `file://` as well as from a static host.
- One deck per page for now: `defineDeck` registers the single `<saburto-deck>` tag, so loading a
  second deck bundle replaces the first.

## Sizing and theming

The deck fills its container's width and is 16:9 by default. Its type is sized to *its own box*,
not to the page or the viewport — 1cqi is 1% of the deck's width — and is shrunk further if a
slide would not otherwise fit. **A slide is never scrolled**: it is scaled to fit instead.

The host page has the last word on both, with ordinary CSS:

```css
saburto-deck { aspect-ratio: 4 / 3 }              /* a squarer box */
saburto-deck { aspect-ratio: auto; height: 22rem }
saburto-deck { width: 30rem }                     /* type follows the box */
saburto-deck { --sd-bg: #fffdf5; --sd-accent: #b45309 }
```

| Variable | Use |
| --- | --- |
| `--sd-bg` | deck background |
| `--sd-fg` | body text |
| `--sd-muted` | counter and secondary text |
| `--sd-border` | hairlines |
| `--sd-accent` | links |
| `--sd-surface` | inline code and buttons |

The theme is the host's decision, never guessed:

| `theme` attribute | Result |
| --- | --- |
| absent, or `light` | light palette |
| `dark` | dark palette |
| `system` | follows `prefers-color-scheme` |

## Host API

```js
const deck = document.querySelector('saburto-deck')

deck.present()                      // take over the screen
deck.goTo(2)                        // jump to a slide (0-based, clamped)
deck.addEventListener('saburto-deck-mode-change', (event) => {
  console.log(event.detail)         // { mode, index, count }
})
```

| Member | Notes |
| --- | --- |
| `mode` | `'embedded'` or `'present'` |
| `slideIndex`, `slideCount`, `deckTitle` | read-only |
| `present()`, `exitPresent()`, `togglePresent()` | the host can put the deck in and out of present mode ([R10](PLAN.md)) |
| `next()`, `prev()`, `goTo(index)` | same navigation the keyboard and buttons use |
| `saburto-deck-mode-change` | detail `{ mode, index, count }` |
| `saburto-deck-slide-change` | detail `{ index, count }` |

Both events bubble and cross the shadow boundary, so a listener on `document` sees them.

## Keyboard

| Key | Embedded (once the deck has focus) | Presenting |
| --- | --- | --- |
| `→` `↓` `PageDown` `Space` | next slide | next slide |
| `←` `↑` `PageUp` | previous slide | previous slide |
| `Home` / `End` | first / last slide | first / last slide |
| `Esc` | — | leave present mode |
| `Tab` | moves on through the page | cycles within the deck |

The deck takes the keyboard **only while it has focus**; click it, or Tab to it. Everywhere else
the page scrolls normally ([N2](PLAN.md)). While presenting, focus is contained and returned on
exit, and `prefers-reduced-motion` removes the slide transition. Slide changes are announced to
screen readers through a live region.

## Presenting, and coming back

Present mode is a fixed overlay from the deck's own shadow tree, plus the native Fullscreen API
when the browser has it. The overlay is what guarantees a full-screen presentation; fullscreen
only removes the browser chrome, so present mode does not depend on it being available or
permitted. The presenter gets a bar with previous/next, a counter and a way out.

Leaving present mode puts the deck back on the same slide, and the page back at the same scroll
offset, that the reader was at on the way in ([R7](PLAN.md)). The host element keeps its place in
the page's flow while presenting, so the page's height never changes.

## Is this a real deck?

While embedded, the deck renders inside a shadow root with `all: initial` on the host, so:

- the host page's CSS does not reach into the deck, even hostile rules aimed straight at `h1`,
  `p`, `section` and `button`;
- the deck's CSS does not leak out — a host page's appearance is identical with and without a deck
  embedded ([R8](PLAN.md));
- both of those are asserted by the test suite, not just claimed.

## Tests

```bash
bun run verify      # typecheck → unit → build → e2e
bun run test        # 13 unit tests (Bun): the slide splitter and a real MDX compile
bun run test:e2e    # 18 end-to-end tests (Playwright) against the built bundle
```

The e2e suite drives the demo host page in a real browser and covers embedded mode, present mode,
isolation in both directions, host control, keyboard behaviour, focus containment, reduced motion,
the no-Fullscreen-API path, and place restoration. `bun run test:e2e --headed` watches it work.

## Where the requirements live

[PLAN.md](PLAN.md) is the requirements document. How each one is met:

| | Where |
| --- | --- |
| R1 single source | one `.mdx` file per deck, compiled once in `decks/` |
| R2 slides | `---` separators — `src/build/remark-slides.ts` |
| R3 text content | MDX rendering |
| R4 embedding | per-deck IIFE bundle; `demo/index.html` |
| R5 embedded mode | one slide in the host's box, type fitted to it — `src/runtime/styles.ts` |
| R6 present mode | fixed overlay + native fullscreen, keyboard and a control bar |
| R7 reversible switching | `#rememberPlace` / `#restorePlace` in `src/runtime/element.ts` |
| R8 isolation | shadow root, `all: initial`; tested in both directions |
| R9 platform coverage | the overlay is the presentation surface; fullscreen is optional |
| R10 host control | `present()` / `exitPresent()` and the mode-change event |
| N1 no host build step | static IIFE, verified from `file://` |
| N2 accessibility | keyboard table above, focus containment, live region, reduced motion |
| N3 compatibility | current desktop browsers; Chromium in the automated tests |

## Limitations

- **One deck per page.** Two deck bundles on one page: the last one wins.
- **One deck per build.** `vite.config.ts` names `decks/example.deck.ts` as its library entry, so
  a second deck means another entry (and eventually per-deck tags).
- **A transformed ancestor breaks the overlay.** `position: fixed` inside an ancestor with
  `transform`, `filter` or `will-change` is positioned against that ancestor instead of the screen.
- **Text only**, as required: no images, code blocks, speaker notes, transitions or PDF export.
- **Tiny boxes get tiny type.** Because a slide is never scrolled, a box far too small for its
  content is scaled down until it fits, which can be unreadable rather than clipped.
- **Chromium only in the automated tests.** WebKit and Firefox projects would need browser
  downloads, which this repository does not do.
- **Desktop browsers only.** Mobile browsers are not a target for this version: the deck is sized
  from the box the host page gives it, and there is no touch navigation beyond the on-screen
  controls.
