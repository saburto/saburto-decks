# AGENTS.md

A deck is an MDX file compiled to a **React component**, embedded in a host page as a component:
one slide at a time in the host's layout, or full screen. [PLAN.md](PLAN.md) says what it must do;
[README.md](README.md) says how to use it. This file says how the repository is put together, and
the traps in it.

## Rules

- **PLAN.md is requirements-level only.** No stack details, file layouts, code samples, API
  signatures, or implementation steps. State what the product must do, not how.
- **PLAN.md owns the requirements; README.md documents usage.** Do not restate a requirement in
  README.md, and do not cite requirement numbers there — a second copy of the requirements is a
  second thing to keep in sync. Requirement numbers belong in PLAN.md, in code comments, and in
  test names.
- **Scope is deliberately minimal:** slides of simple text. Do not add features, dependencies,
  files, or documents that were not asked for.
- **Fixed stack:** Bun (scripts and unit tests), Vite and Astro (builds), React 19 + MDX (a deck is
  a React component). One package, `@saburto/saburto-decks`.
- Code comments cite requirement numbers (`R5`, `N1`) from PLAN.md. **If you renumber a
  requirement, grep for it** — the numbers are referenced in `src/`, `test/` and `e2e/`.

## Layout

```
src/runtime/     ships to the browser: Deck.tsx (the component), Slide.tsx, Slides.tsx, Cover.tsx, Agenda.tsx, Columns.tsx, Canvas.tsx, tailwind.css
src/build/       build-time only, never shipped: the MDX → <Slide> transform, the <Slides> include
src/mdx.ts       the Vite plugin and remark pipeline a host's config uses
src/index.ts     the component entry — it must never import the build half
decks/           example.mdx: the deck both demo hosts embed
scripts/         development tools, never shipped: inspect.ts, compile.ts
demo/            an Astro site that embeds it as an island
react-demo/      a plain React app that embeds the same deck
e2e/             Playwright specs; test/ holds the Bun unit tests
```

Two demo hosts are kept on purpose. The Astro one is the target that matters; the React one proves
a deck is a React component and nothing more, and gives the suite a second, non-Astro host.

## Commands

```bash
bun run verify       # typecheck → unit tests → build → e2e tests. Run this before saying done.
bun run test         # unit tests (Bun)
bun run test:e2e     # end-to-end tests (Playwright), against both built demos
bun run typecheck    # tsc --noEmit
bun run build        # the library, then both demo sites
bun run dev          # the Astro demo with hot reload
bun run dev:react    # the React demo with hot reload
bun run demo         # build, then serve the Astro demo at http://127.0.0.1:4173/
bun run inspect      # a slide on screen: its state, and a PNG if asked. Dev tool only.
bun run compile      # print what a deck file compiles to. Dev tool only.
```

## Traps

Each of these has already cost time here.

- **A deck is a React component, and Astro's MDX integration does not produce React.** Do not add
  `@astrojs/mdx` to a host and expect `<Deck slides={slides} />` to work: it compiles MDX to Astro
  components. `saburtoDecks()` from `./mdx` brings `@mdx-js/rollup` and the remark pipeline instead.
- **The deck renders in a shadow root, so it is client-only.** Nothing inside it is in the
  server-rendered HTML. That is the accepted cost of R8; do not "fix" it by dropping the shadow
  root without the owner's say-so.
- **The deck's host is a `div`, and outer rules beat `:host` for the host element itself.** That is
  why the properties that reach the deck's text (font, colour, line-height) are set again on
  `.deck` _inside_ the shadow root. Keep them there.
- **The stylesheet is Tailwind v4, compiled into the shadow root.** `src/runtime/tailwind.css`
  imports Tailwind's theme and utilities (not preflight — the deck has its own reset) and holds the
  CSS Tailwind cannot express; `styles.ts` hands the compiled string to the shadow root. A utility
  only exists if the scanner saw it, so `@source` decides what is compiled, and a host authoring
  its own utilities in a deck needs its own Tailwind build.
- **MDX v3 does not parse frontmatter.** `remark-frontmatter` must be in the pipeline, or `---`
  becomes a setext heading.
- **`Deck.tsx` wraps the slides in `SlideContext.Provider`.** Drop it and every slide thinks it is
  slide 1: the counter moves while the slides do not.
- **The deck must never scroll.** A slide is scaled to fit its box instead (see `fitStage` in
  `Deck.tsx`). Do not reintroduce a scroll container.
- **`bun test` and Playwright both claim `*.spec.ts`.** The unit script passes
  `--path-ignore-patterns='e2e/**'`, and `verify` must call `bun run test`, not `bun test`.
- **Run Playwright through `bun run test:e2e`.** `bunx playwright` executes it under Bun and fails
  with a `bun:` protocol error. Its config uses `channel: 'chromium'` so no browser is downloaded.
- **The e2e tests drive the built demo sites**, and there are two web servers (4173 for Astro, 4174
  for React) — `verify` builds before testing.
- **An `.d.ts` beside a `.ts` of the same name is that module's declaration file, not ambient
  globals.** The `*.mdx` declaration lives in `src/ambient.d.ts` for exactly this reason.

## Decisions already taken

Do not relitigate these without the owner.

- **A component, not a custom element, and never a script tag.** The host imports `<Deck>` and
  renders it; there is no bundle to load, no tag to register, no snippet. R4 was rewritten for this.
- **Hosts must be able to render React components** (an Astro site with `@astrojs/react`, or any
  React app). A static HTML page is not a host.
- **The shadow root stays (R8).** The accepted cost: the slides are not in the server HTML.
- **React, not Preact.** Do not alias `react` to `preact/compat`, and do not treat payload size as
  a design constraint — it is not one.
- **Tailwind v4, compiled into the shadow root.** The deck's own components are styled with
  utilities; `src/runtime/tailwind.css` imports the theme and utilities and is injected into the
  shadow root, so the host page is still untouched. Preflight is deliberately left out: the deck
  has its own reset (`all: initial`) and its own content typography, and preflight inside a shadow
  tree would strip the list markers and heading weights the slides rely on.
- **One deck per page is no longer a limit.** Each `<Deck>` gets its own shadow root, so several
  decks can coexist.
- **A presenting deck covers the page it is in,** so the host's own controls are unreachable while
  presenting. Host-driven exit is `exitPresent()` from the host's code; the reader's own exits are
  `Esc` and the deck's bar.
- **An include is a real import, and the included file compiles as its own module (R18).**
  `<Slides src="./part.mdx" />` becomes `import … from './part.mdx'`, not a copy of its text.
  That is what makes the included file's own pictures resolve against its own folder and what
  makes Vite watch it. Textual splicing was considered and rejected for exactly those reasons.
  The include's slides are flattened into the deck when it stands on a slide of its own; inside a
  slide, its `<Slide>` elements render transparently as that slide's content.
