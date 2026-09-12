# AGENTS.md

Embeddable slide decks authored in MDX: a deck shows one slide at a time inside a host page, and
the same deck presents full screen. [PLAN.md](PLAN.md) says what it must do; [README.md](README.md)
says how to use it. This file says how the repository is put together, and the traps in it.

## Rules

- **PLAN.md is requirements-level only.** No stack details, file layouts, code samples, API
  signatures, or implementation steps. State what the product must do, not how.
- **Scope is deliberately minimal:** slides of simple text. Do not add features, dependencies,
  files, or documents that were not asked for.
- **Fixed stack:** Bun (scripts and unit tests), Vite 8 (builder), React 19 + MDX (authoring),
  Playwright (end-to-end tests). One package, `@saburto/saburto-decks`.
- Code comments cite requirement numbers (`R5`, `N2`) from PLAN.md. **If you renumber a
  requirement, grep for it** — the numbers are referenced in `src/`, `test/` and `e2e/`.

## Layout

```
src/runtime/     ships in the deck bundle: the element, the React view, the stylesheet
src/build/       runs at build time and must never ship: the MDX → slides transform
src/index.ts     barrel re-exporting both halves, so nothing shipped may import it
decks/           a deck (.mdx) and its bundle entry (.deck.ts)
demo/            the host page: plain static HTML, no build step, on purpose
e2e/             Playwright specs; test/ holds the Bun unit tests
scripts/serve.ts static server for the demo, and the e2e web server
```

## Commands

```bash
bun run verify      # typecheck → unit tests → build → e2e tests. Run this before saying done.
bun run test        # unit tests (Bun)
bun run test:e2e    # end-to-end tests (Playwright)
bun run typecheck   # tsc --noEmit
bun run build       # → dist/example.deck.js
bun run demo        # build, then serve the demo at http://127.0.0.1:4173/demo/
bun run dev         # Vite's dev server instead; needs dist/ to have been built
```

`HOST=0.0.0.0 bun run demo` binds to the network instead of localhost, if you want to reach the
demo from another machine.

## Traps

Each of these has already cost time here.

- **Vite library mode leaves `process.env.NODE_ENV` unresolved.** Both the development and the
  production build of React then ship. The `define` block in `vite.config.ts` is load-bearing;
  after any Vite upgrade, check `rg -c process.env.NODE_ENV dist/example.deck.js` → `0`.
- **A shipped entry must import from `runtime/`, not from `src/index.ts`.** The barrel re-exports
  the build-time half too, so importing it drags `unist-util-mdx-define` and friends into the
  module graph. They are currently shaken out, but nothing then stops them from shipping.
- **MDX v3 does not parse frontmatter.** `remark-frontmatter` must be in the pipeline, or `---`
  becomes a setext heading. Injected exports need `unist-util-mdx-define`: a hand-built `mdxjsEsm`
  node is silently dropped, and `value` stays empty even when it works — MDX reads `data.estree`.
- **The stylesheet is a template string.** A backtick in a CSS comment terminates it.
- **The deck must never scroll.** A slide is scaled to fit its box instead; the fit loop lives in
  `#fitStage`. Do not reintroduce a scroll container or the keys that fed one.
- **`bun test` and Playwright both claim `*.spec.ts`.** The unit script passes
  `--path-ignore-patterns='e2e/**'`, and `verify` must call `bun run test`, not `bun test`.
- **Run Playwright through `bun run test:e2e`.** `bunx playwright` executes it under Bun and fails
  with a `bun:` protocol error. Its config uses `channel: 'chromium'` so no browser is downloaded.
- **The e2e tests drive the built bundle**, so `dist/` must be current — `verify` builds first.

## Decisions already taken

Do not relitigate these without the owner.

- **No CSS framework.** Tailwind v4 does work inside a shadow root, but it cannot express the
  layout (container-relative `cqi` type that is shrunk to fit) and a host page's Tailwind cannot
  reach into the shadow root, so every deck would embed its own generated copy. The stylesheet is
  ~200 lines of purpose-written CSS.
- **React, not Preact.** React 19 is the runtime; do not alias `react` to `preact/compat` and do
  not treat payload size as a design constraint — it is not one.
- **One deck per page.** `defineDeck` registers the single `<saburto-deck>` tag, so a second deck
  bundle on the same page replaces the first. Per-deck tags are the fix when that matters.
- **Present mode is a fixed overlay inside the shadow tree,** plus native fullscreen when the
  browser has it. Present mode therefore does not depend on the Fullscreen API existing or being
  permitted; fullscreen only removes the browser chrome.
