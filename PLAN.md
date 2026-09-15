# Saburto Decks — Requirements

## Purpose

To make **infodecks** easy to create. An infodeck is a deck meant to be read rather than
projected: a document that uses slides and spatial layout to explain something, and that is worth
treating as a form of writing in its own right
([Martin Fowler, *Infodeck*](https://martinfowler.com/bliki/Infodeck.html)).

The form is poorly served by the tools that exist. Presentation software takes over the whole page
and is built for an audience in a room; hand-written article HTML has no deck behaviour at all. So
a deck is authored once and used two ways: **embedded** inside an existing web page, and
**presented full screen** from the same source.

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

**R11 — Code.** A slide can contain fenced code blocks. Code is syntax-highlighted, and the
highlighting is produced when the deck is built, not when it is shown: no highlighter, grammar or
theme reaches the browser. A code block may name the file it came from and mark the lines that
matter. Like all slide content, a code block is sized to the deck's box and is never scrolled.

**R12 — Steps.** A code block can declare an ordered sequence of highlighted line sets. The deck
moves through that sequence one step at a time — with the same next/previous navigation — and
only leaves the slide once the last step has been shown. A step can show
no highlights at all, or take the code block off the slide entirely. Going back reverses the
sequence, and from a slide's first step returns to the previous slide's last step. The reader can
see how many steps the slide has and where in them they are. The host can drive and observe
steps, as it can slides.

**R13 — Diagrams.** A slide can contain a Mermaid diagram. The diagram is drawn as a diagram, not
shown as its source, and it follows the deck's theme. Like all slide content, it is sized to the
deck's box and is never scrolled. A diagram whose kind has no declared order appears whole, as one
step.

**R14 — Diagram steps.** A sequence diagram is revealed one element at a time, in the order the
diagram declares them: each participant, then each message or note. A diagram drawn as a graph — a
flowchart, a state diagram, a class diagram — is revealed the same way: each node, then each edge.
Those elements are steps of the slide, reached and reversed with the same navigation as any other
step, and counted and announced with them. An author can turn a diagram's reveal off, so the whole
diagram is shown at once.

**R15 — Annotations.** A slide can mark a passage with a hand-drawn annotation — a highlight, an
underline, a box, a circle, a strike-through or a bracket — to bring the eye to it. An annotation is
decoration: it never changes the passage's text or its meaning, and it never changes the slide's
layout or the size its type settles on. An annotation can be revealed as one of the slide's steps,
counted and navigated with the others (R12); by default it appears with the slide. It follows the
deck's theme and palette, and it respects the reader's reduced-motion preference.

**R16 — Motion.** A slide can animate an object: it can arrive on one of the slide's steps, or
move on one — to a place the author names, or to wherever the slide's own layout puts it. An object
that has not arrived still occupies its place, so nothing else on the slide shifts as the reader
steps, and the type size the slide settled on does not change under them. Stepping back undoes the
motion. The reader's reduced-motion preference is respected: without animation, objects are simply
in the right place.

**R17 — Contents.** A deck has a table of contents built from its slides: an entry per slide,
named by the slide's own first heading, with the slide the reader is on marked. A slide without a
heading still has an entry. The reader can open the contents from any slide, in either mode, and
choosing an entry goes to that slide. Opening and choosing are keyboard-operable and dismissing
the contents returns the reader to the deck. Opening the contents changes neither a slide's
layout nor the type size the deck settled on. An author can also place the contents on a slide,
where they are that slide's own content and are sized with it.

**R18 — Several files.** A deck can be written as more than one file: one file includes the
slides of another. On a slide of its own, an include is those slides — ordered where the include
was written, counted and navigated with the deck's own, and listed in the deck's contents. Used
inside a slide, an include is that slide's content instead: it adds no slides and its steps count
with the slide's. The same include can be used both ways. An included file may include another
file, but not itself. An included file's own pictures and imports belong to it and resolve
relative to it, not to the deck that included it. Changing an included file is reflected in the
deck when it is rebuilt and while it is being developed.

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
5. A sequence diagram is revealed a participant and a message at a time, and a graph diagram — a
   flowchart, state diagram or class diagram — a node and an edge at a time, as the reader advances;
   a diagram with no such order is shown whole.
6. A passage on a slide can be marked with a hand-drawn annotation, and that annotation can be one
   of the slide's steps, without changing the passage's text or whether the slide fits.
7. An object on a slide can be made to arrive on one step and to move on a later one, keeping its
   place while it waits, and the motion reverses when the reader steps back.
8. From any slide, in either mode, the reader can open a table of contents, see which slide they
   are on, and choose an entry to go to that slide; a slide with no heading is still listed,
   opening the contents does not change how the slide fits, and the contents can be the content
   of a slide the author writes.
9. A deck can be written across files: an include brings another file's slides in as the deck's
   own — ordered, counted, navigated and listed with them — while the same include inside a slide
   is part of that slide, adding no slides and counting its steps with the slide's.

## Fixed decisions from the owner

- Package name: `@saburto/saburto-decks`, one package.
- Builder: Vite. Runner: Bun.
- Authoring format: MDX with React. A deck is a React component, and host pages embed it as a
  component — not as a script, and not as a custom element.
- Embedded use comes first; all other delivery forms wait.
- Present mode is full screen.
