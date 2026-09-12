# Saburto Decks — Requirements

## Purpose

Author a slide deck once, then use it two ways: **embedded** inside an existing web page, and
**presented full screen** from the same source. This is the *infodeck* idea — a deck that lives
inside a page without stopping being a deck.

Today the choice is between presentation tools that take over the whole page, and hand-written
article HTML with no presentation mode.

## Users

- A writer publishing an article who wants a deck embedded in the page, navigable in place.
- A speaker presenting that same content full screen, without maintaining a second version.

## Functional requirements

**R1 — Single source.** A deck lives in one text file. The same file produces both embedded and
present mode. No duplicate content, no separate build per mode.

**R2 — Slides.** Slides are separated by a simple marker in the file. A deck's slides are
ordered. The file may carry a title and basic metadata.

**R3 — Text content.** A slide can contain headings, paragraphs, lists, links, emphasis and
inline code. Nothing else is required for this version.

**R4 — Embedding.** A deck is embedded in an existing page as a component, in the page's own
authoring format, alongside the page's own content. The host page supplies the deck file and
places the component where the deck should appear, and the page may drive the deck from its own
code. Host pages are therefore ones that can render components; a page that is only static HTML
is not a host.

**R5 — Embedded mode.** In embedded mode the deck is part of the page and shows one slide at a
time: it occupies a box supplied by the host, and the host can size that box. The deck's text is
sized to the deck's own box, not to the page or the screen, and a slide is scaled to fit its box
rather than being scrolled. The slides are never laid out one after another as flowing article
content.

**R6 — Present mode.** In present mode the deck takes over the screen. One slide is shown at a
time, sized to the screen. Next, previous, jump-to-slide and keyboard navigation work. The
presenter can leave present mode and return to the embedded deck.

**R7 — Reversible switching.** Leaving present mode returns the deck to the same slide, and the
host page to the same scroll position, that they were at on the way in. Switching mode must never
lose the reader's place.

**R8 — Isolation.** The deck's styling must not leak into the host page, and the host page's
styling must not change how the deck looks. A host page's appearance must be identical before
and after a deck is embedded.

**R9 — Platform coverage.** Both modes must work on current desktop browsers. Present mode must
not silently fail — if the screen cannot be taken over, the presenter must still get a usable
full-screen presentation.

**R10 — Host control.** The host page can put the deck into and out of present mode, and is
notified when the mode changes.

## Non-functional requirements

**N1 — Accessibility.** Both modes are fully keyboard navigable. Focus is contained while
presenting and restored on exit; while embedded, the deck takes the keyboard only when the reader
has focused it, and Tab moves into and out of it normally. Reduced-motion preferences are
respected.

**N2 — Compatibility.** Current Chrome, Edge, Firefox and Safari.

## Acceptance criteria

This version is done when:

1. A text file with three slides can be embedded in a page as a component, and the deck appears
   in the page showing one slide at a time when it is opened in a browser.
2. The same page, in present mode, shows one slide at a time filling the screen, and can be
   navigated forwards and backwards with the keyboard.
3. Leaving present mode returns the reader to the slide and scroll position they were at.
4. The host page's appearance is unchanged before and after the deck is embedded.

## Fixed decisions from the owner

- Package name: `@saburto/saburto-decks`, one package.
- Builder: Vite. Runner: Bun.
- Authoring format: MDX with React. A deck is a React component, and host pages embed it as a
  component — not as a script, and not as a custom element.
- Embedded use comes first; all other delivery forms wait.
- Present mode is full screen.
