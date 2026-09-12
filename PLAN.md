# Saburto Decks — Requirements

## Purpose

Author a slide deck once, then use it two ways: **read inline** inside an existing web page, and
**presented full screen** from the same source. This is the *infodeck* idea — a deck designed to
be read as well as presented.

Today the choice is between presentation tools that take over the whole page, and hand-written
article HTML with no presentation mode.

## Users

- A writer publishing an article who wants slide-like sections inside the page, readable in place.
- A speaker presenting that same content full screen, without maintaining a second version.

## Functional requirements

**R1 — Single source.** A deck lives in one text file. The same file produces both read and
present mode. No duplicate content, no separate build per mode.

**R2 — Slides.** Slides are separated by a simple marker in the file. A deck's slides are
ordered. The file may carry a title and basic metadata.

**R3 — Text content.** A slide can contain headings, paragraphs, lists, links, emphasis and
inline code. Nothing else is required for this version.

**R4 — Embedding.** A deck can be added to an existing HTML page with a small snippet. The host
page must not need a build step, a framework, or changes to its own tooling.

**R5 — Read mode.** In read mode the deck is ordinary page content: it flows with the page, takes
the width of its container, and has no fixed height or scroll container of its own.

**R6 — Present mode.** In present mode the deck takes over the screen. One slide is shown at a
time, sized to the screen. Next, previous, jump-to-slide and keyboard navigation work. The
presenter can leave present mode and return to reading.

**R7 — Reversible switching.** Leaving present mode returns the reader to the same slide and the
same scroll position they left. Switching mode must never lose their place.

**R8 — Isolation.** The deck's styling must not leak into the host page, and the host page's
styling must not change how the deck looks. A host page's appearance must be identical before
and after a deck is embedded.

**R9 — Platform coverage.** Both modes must work on current desktop browsers and on iOS Safari.
Present mode must not silently fail on a platform — if the screen cannot be taken over, the
presenter must still get a usable full-screen presentation.

**R10 — Host control.** The host page can put the deck into and out of present mode, and is
notified when the mode changes.

## Non-functional requirements

**N1 — Weight.** The deck engine's own payload must be ≤ 20 kB gzipped, so embedding a deck does
not noticeably slow down a host page.

**N2 — No host build step.** Embedding must work from static files.

**N3 — Accessibility.** Both modes are fully keyboard navigable. Focus is contained while
presenting and restored on exit. Reduced-motion preferences are respected.

**N4 — Compatibility.** Current Chrome, Edge, Firefox and Safari, plus iOS Safari.

## Acceptance criteria

This version is done when:

1. A text file with three slides can be embedded in a plain HTML page with a small snippet, and
   the slides appear inline in the page when it is opened in a browser.
2. The same page, in present mode, shows one slide at a time filling the screen, and can be
   navigated forwards and backwards with the keyboard.
3. Leaving present mode returns the reader to the slide and scroll position they were at.
4. The host page's appearance is unchanged before and after the deck is embedded.
5. All of the above also hold on an iPhone.
6. The engine payload is ≤ 20 kB gzipped.

## Fixed decisions from the owner

- Package name: `@saburto/saburto-decks`, one package.
- Builder: Vite. Runner: Bun.
- Authoring format: MDX with React.
- Embedded use comes first; all other delivery forms wait.
- Present mode is full screen.
