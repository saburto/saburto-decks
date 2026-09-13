/**
 * The deck's entire stylesheet. It is injected into the element's shadow root,
 * so nothing here can leak out and nothing outside can leak in.
 *
 * There is one way to render the deck: a single slide on a stage, scaled to
 * the space it has. Embedded, that space is the host's box (16:9 by default);
 * presenting, it is the screen. The only difference between the two is how
 * much room the deck is given.
 *
 * `all: initial` on `:host` severs inheritance from the host page (R8). The
 * outer tree wins over `:host` rules for the host element itself, so the
 * properties that actually reach the deck's text are set again on `.deck`,
 * inside the shadow root, where no host rule can reach them.
 */
export const deckStyles = /* css */ `
  :host {
    all: initial;
    /* The host may set these, which is how theming is meant to work. */
    --sd-bg: #ffffff;
    --sd-fg: #16181d;
    --sd-muted: #5b6472;
    --sd-border: #d8dce3;
    --sd-accent: #2f6fed;
    --sd-surface: #f2f4f7;
    /* How far the lines outside the current step recede (R12). */
    --sd-code-dim: 0.3;
    /* The colour a highlight is drawn in. A highlight is a thick stroke behind
       the words, so it is translucent: the words stay readable under it (R15). */
    --sd-highlight: rgba(255, 208, 0, 0.45);

    display: block;
    position: relative;
    overflow: hidden;
    background: var(--sd-bg);

    /* A definite size in both axes, so the deck can size its own type to its
       own box rather than to the page or the viewport. The default box is set
       inline by the component (so the server-rendered HTML reserves the right
       space); a host overrides it with the --sd-aspect property or its own
       inline style. */
    aspect-ratio: var(--sd-aspect, 16 / 9);
  }

  :host(:focus-visible) {
    outline: 2px solid var(--sd-accent);
    outline-offset: 2px;
  }

  /* The host chooses the theme explicitly so the deck never guesses. */
  :host([data-theme="dark"]) {
    --sd-bg: #111318;
    --sd-fg: #e8eaed;
    --sd-muted: #9aa4b2;
    --sd-border: #2c313a;
    --sd-accent: #7aa2f7;
    --sd-surface: #1b1f27;
    --sd-highlight: rgba(255, 208, 0, 0.32);
  }
  @media (prefers-color-scheme: dark) {
    :host([data-theme="system"]) {
      --sd-bg: #111318;
      --sd-fg: #e8eaed;
      --sd-muted: #9aa4b2;
      --sd-border: #2c313a;
      --sd-accent: #7aa2f7;
      --sd-surface: #1b1f27;
      --sd-highlight: rgba(255, 208, 0, 0.32);
    }
  }

  .mount { display: contents; }

  .deck {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    /* The deck is its own size container, so 1cqi means 1% of the deck's own
       width whether the deck is in a page or on the whole screen. */
    container-type: size;
    color: var(--sd-fg);
    background: var(--sd-bg);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 1rem;
    line-height: 1.5;
    text-align: start;
  }

  /* ---- the stage: one slide, fitted to whatever room there is ---- */
  .stage {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    place-content: center;
    overflow: hidden;
    padding: 4cqi 6cqi;
    /* The size to start from: 1cqi is 1% of the deck's own width, so type is
       sized to the deck and not to the page or the screen. The element then
       shrinks this further when a slide would not otherwise fit. */
    font-size: clamp(0.9rem, 2.4cqi, 2.2rem);
  }

  /* Deliberately not measured in ch: the column must not get narrower as the
     type shrinks, or fitting a slide would fight itself. */
  .slide { display: none; width: 100%; max-width: 72cqi; overflow-wrap: break-word; }
  .slide[data-active] { display: block; }
  .slide > :first-child { margin-block-start: 0; }
  .slide > :last-child { margin-block-end: 0; }

  h1, h2, h3, h4 { line-height: 1.15; text-wrap: balance; }
  h1 { font-size: 1.9em; }
  h2 { font-size: 1.45em; }
  h3 { font-size: 1.15em; }
  p, ul, ol, blockquote { margin-block: 0.85em; }
  ul, ol { padding-inline-start: 1.4em; }
  li + li { margin-block-start: 0.3em; }
  a { color: var(--sd-accent); text-decoration-thickness: from-font; }
  strong { font-weight: 700; }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.9em;
    background: var(--sd-surface);
    padding: 0.1em 0.35em;
    border-radius: 0.3em;
  }

  /* ---- code blocks ----
     Shiki highlights at build time and gives each token a colour per theme,
     as CSS variables; the deck's own palette picks one, exactly as it does
     for the rest of the slide. Like every other slide content, a code block
     never scrolls: long lines wrap, and the type shrinks to fit the stage
     (R11, R5). */
  pre.shiki {
    margin-block: 0.7em;
    padding: 0.8em 1em;
    border-radius: 0.5em;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.8em;
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    tab-size: 2;
  }
  pre.shiki code {
    font-family: inherit;
    font-size: inherit;
    background: none;
    padding: 0;
    border-radius: 0;
  }
  pre.shiki,
  pre.shiki span { color: var(--shiki-light); }
  pre.shiki { background-color: var(--shiki-light-bg); }
  /* Shiki's convention, and Slidev's: the current step's lines keep the colour
     they always had, and the lines it does not name recede. Nothing about the
     highlighted line changes — no background, no box — so a line of code looks
     the same whether or not it is the one being shown (R12). */
  pre.shiki.has-highlighted .line:not(.highlighted) {
    opacity: var(--sd-code-dim, 0.3);
  }

  /* A {hide} step: the block and the title bar above it leave the slide. */
  pre.shiki[hidden],
  .sd-code-title[hidden] { display: none; }
  :host([data-theme="dark"]) pre.shiki,
  :host([data-theme="dark"]) pre.shiki span { color: var(--shiki-dark); }
  :host([data-theme="dark"]) pre.shiki { background-color: var(--shiki-dark-bg); }
  @media (prefers-color-scheme: dark) {
    :host([data-theme="system"]) pre.shiki,
    :host([data-theme="system"]) pre.shiki span { color: var(--shiki-dark); }
    :host([data-theme="system"]) pre.shiki { background-color: var(--shiki-dark-bg); }
  }

  /* The file a snippet came from, as a bar the code panel sits under. */
  .sd-code-title {
    margin-block: 0.7em 0;
    padding: 0.35em 0.9em;
    border: 1px solid var(--sd-border);
    border-block-end: 0;
    border-start-start-radius: 0.5em;
    border-start-end-radius: 0.5em;
    background: var(--sd-surface);
    color: var(--sd-muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.72em;
    line-height: 1.4;
  }
  .sd-code-title + pre.shiki {
    margin-block-start: 0;
    border-start-start-radius: 0;
    border-start-end-radius: 0;
  }

  /* ---- diagrams ----
     A Mermaid diagram is drawn in the browser (R13) and is sized like every
     other piece of slide content: it narrows with the deck's type and is
     scaled to fit the box, never scrolled. A sequence diagram is revealed one
     element at a time (R14); the elements not yet reached keep their place but
     are not shown, so nothing moves as the drawing fills in. */
  .sd-mermaid { margin-block: 0.7em; }
  .sd-mermaid-render {
    display: block;
    width: 100%;
    max-width: min(100%, 30em);
    margin-inline: auto;
  }
  .sd-mermaid svg {
    display: block;
    width: 100%;
    height: auto;
    max-width: 100%;
  }
  .sd-mermaid [data-sd-step] {
    visibility: hidden;
    opacity: 0;
  }
  .sd-mermaid [data-sd-step].sd-shown {
    visibility: visible;
    opacity: 1;
  }
  @media (prefers-reduced-motion: no-preference) {
    .sd-mermaid [data-sd-step] { transition: opacity 160ms ease-out; }
  }
  /* The source, shown only when Mermaid could not draw it. An author display
     rule would otherwise beat the UA rule for [hidden], so it is restated. */
  .sd-mermaid-source {
    display: block;
    white-space: pre-wrap;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.72em;
    color: var(--sd-muted);
  }
  .sd-mermaid-source[hidden] { display: none; }

  /* ---- motion (R16) ----
     An object that arrives or moves is shown and placed by Motion, which
     writes its own opacity and transform inline. The deck says only how the
     object sits in the flow: a span by default, so it is legal inside a
     paragraph, and a block when that is asked for. It keeps its place while it
     waits — the point of the whole arrangement is that a step must never
     change the slide's layout. A transform does not apply to a plain inline
     box, so the default box is an inline-block, bounded so a long passage
     wraps rather than overflowing the slide. */
  .sd-motion { display: inline-block; max-width: 100%; }
  .sd-motion[data-as="div"] { display: block; }

  @media (prefers-reduced-motion: no-preference) {
    .slide[data-active] { animation: sd-enter 160ms ease-out both; }
  }
  @keyframes sd-enter {
    from { opacity: 0; transform: translateY(0.35em); }
    to { opacity: 1; transform: none; }
  }

  /* ---- annotations (R15) ----
     A hand-drawn mark over a passage. rough-notation draws it as an SVG beside
     the words, out of the flow, so it never enters the slide's measurement and
     never changes the type size the deck settles on. The deck redraws a mark
     when its passage is remeasured, so it stays on the words it marks.

     Its draw keyframes are declared here, in the tree the annotations live in,
     rather than in document.head where the library would otherwise put them:
     nothing of the deck's styling belongs in the host page (R8). */
  @keyframes rough-notation-dash {
    to { stroke-dashoffset: 0; }
  }

  /* ---- the bar ---- */
  .bar {
    flex: 0 0 auto;
    display: flex;
    gap: 0.4rem;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.75rem;
    font-size: clamp(0.75rem, 1.7cqi, 1.05rem);
    opacity: 0.6;
    transition: opacity 150ms ease-out;
  }
  .bar:hover, .bar:focus-within { opacity: 1; }
  .bar button {
    font: inherit;
    min-height: 2.4em;
    padding: 0.3em 0.9em;
    color: inherit;
    background: var(--sd-surface);
    border: 1px solid var(--sd-border);
    border-radius: 0.5em;
    cursor: pointer;
  }
  .bar button:disabled { opacity: 0.35; cursor: default; }
  .bar button:focus-visible { outline: 2px solid var(--sd-accent); outline-offset: 2px; }
  .counter {
    min-width: 4ch;
    text-align: center;
    color: var(--sd-muted);
    font-variant-numeric: tabular-nums;
  }
  /* How far through a stepped slide the reader is. */
  .steps { display: inline-flex; gap: 0.25rem; align-items: center; }
  .step-dot {
    width: 0.4em;
    height: 0.4em;
    border-radius: 50%;
    background: var(--sd-border);
  }
  .step-dot[data-on] { background: var(--sd-accent); }

  /* ---- present mode: the same deck, on the whole screen ----
     The host element deliberately stays in the page's flow, still occupying
     the box it did before, so the host page's height and scroll position are
     never disturbed (R7). What goes full screen is the deck itself, fixed to
     the viewport, rather than the element the host page placed.

     A fixed overlay rather than a reliance on the Fullscreen API also means a
     browser without it still gets a full-screen deck (R9).
     Native fullscreen, when available, is requested on top and only removes
     the browser chrome. */
  :host([data-mode="present"]) {
    background: transparent;
    overflow: visible;
    outline: none;
  }
  :host([data-mode="present"]) .deck {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
  }
  :host([data-mode="present"])::backdrop { background: var(--sd-bg); }
  :host([data-mode="present"]) .stage { padding: 5cqi 8cqi; }
  :host([data-mode="present"]) .bar { opacity: 0.35; }

  .live {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
`
