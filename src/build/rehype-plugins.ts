/**
 * The rehype pipeline every deck is compiled with: Shiki syntax highlighting,
 * and the step notation that goes with it.
 *
 * Highlighting happens here, at build time, and never in the browser. What
 * reaches the page is finished markup with inline colours, so a deck ships no
 * highlighter and no grammars into the page (R11).
 *
 * Each token carries two colour sets — `--shiki-light` and `--shiki-dark` —
 * and the deck's own stylesheet picks one from the host's `data-theme`, the
 * same way the rest of the palette is chosen. That keeps a code block on the
 * same footing as the text around it.
 *
 * A fence's `{…}` meta describes the lines to highlight. With no `|` it is a
 * single, unchanging state; with `|` it is an ordered sequence the reader
 * steps through — `{all|4|6-7}`, Slidev's notation (R12) — where `hide` takes
 * the block off the slide for a step and `none` shows it with nothing
 * highlighted. Which line belongs to which step is written onto the markup as
 * data, so stepping at run time costs no highlighting work: the deck only
 * moves a marker.
 */
import rehypeShiki, { type RehypeShikiOptions } from '@shikijs/rehype'

type ShikiTransformer = NonNullable<RehypeShikiOptions['transformers']>[number]

/** One step: every line (`all`), a set, no line (`none`), or no block (`hide`). */
type Step = 'all' | 'none' | 'hide' | number[]

/**
 * Reads one `|`-separated step. The keywords are Slidev's: `all`, `*` and an
 * empty segment mean every line, `none` means no line, and `hide` takes the
 * whole block off the slide. Anything else must be numbers and ranges.
 * Returns `null` for a meta that is not a step spec, so it is left alone
 * rather than guessed at.
 */
function parseStep(text: string): Step | null {
  const value = text.trim()
  if (value === '' || value === 'all' || value === '*') return 'all'
  if (value === 'none') return 'none'
  if (value === 'hide') return 'hide'

  const lines = new Set<number>()
  for (const part of value.split(',')) {
    const token = part.trim()
    const range = /^(\d+)\s*-\s*(\d+)$/.exec(token)
    if (range) {
      const from = Number(range[1])
      const to = Number(range[2])
      for (let line = Math.min(from, to); line <= Math.max(from, to); line++) lines.add(line)
      continue
    }
    if (/^\d+$/.test(token)) {
      lines.add(Number(token))
      continue
    }
    return null
  }
  return [...lines]
}

/** The `{…}` part of a fence's meta, as an ordered list of steps. */
function parseSteps(meta: string): Step[] | null {
  const match = /\{([^}]*)\}/.exec(meta)
  if (!match) return null
  const steps = (match[1] ?? '').split('|').map(parseStep)
  return steps.every((step): step is Step => step !== null) ? steps : null
}

/**
 * Writes the step data onto the block: how many steps there are, which steps a
 * line is highlighted in, which steps take the block off the slide, and
 * Shiki's own initial state — `has-highlighted` on the block and `highlighted`
 * on each line that step 0 lights up. The runtime keeps those classes in step
 * with the reader (R12).
 */
const transformerCodeSteps: ShikiTransformer = {
  name: 'saburto:code-steps',
  pre(node) {
    const steps = parseSteps(this.options.meta?.__raw ?? '')
    if (!steps) return
    node.properties['data-steps'] = String(steps.length)

    const hidden = steps.flatMap((step, index) => (step === 'hide' ? [index] : []))
    if (hidden.length > 0) node.properties['data-hide'] = hidden.join(' ')

    /* The block dims the lines its current step does not name; only a hidden
       step has nothing to say about dimming. */
    if (steps[0] !== 'hide') this.addClassToHast(node, 'has-highlighted')
  },
  line(node, line) {
    const steps = parseSteps(this.options.meta?.__raw ?? '')
    if (!steps) return
    const highlighted = steps.flatMap((step, index) =>
      step === 'all' || (Array.isArray(step) && step.includes(line)) ? [index] : []
    )
    if (highlighted.length > 0) node.properties['data-hl'] = highlighted.join(' ')

    const first = steps[0]
    if (first === 'all' || (Array.isArray(first) && first.includes(line)))
      this.addClassToHast(node, 'highlighted')
  }
}

/**
 * `[filename.ts]` — or `title="filename.ts"` — in a fence's meta names the
 * file the snippet came from, shown in a bar above the block.
 *
 * Shiki has no transformer for this, so the title is inserted as a plain
 * `<div class="sd-code-title">` before the `<pre>`; the stylesheet frames the
 * two together. The bar is decoration: the code block reads correctly without
 * it, so it is hidden from assistive technology.
 */
const transformerCodeTitle: ShikiTransformer = {
  name: 'saburto:code-title',
  root(node) {
    const meta = this.options.meta?.__raw ?? ''
    const title = /\[([^\]]+)\]/.exec(meta)?.[1] ?? /(?:^|\s)title="([^"]*)"/.exec(meta)?.[1]
    if (!title) return
    node.children.unshift({
      type: 'element',
      tagName: 'div',
      properties: { className: ['sd-code-title'], 'aria-hidden': 'true' },
      children: [{ type: 'text', value: title }]
    })
  }
}

/** What a deck author gets: two themes, steps, and a file name. */
const shikiOptions: RehypeShikiOptions = {
  themes: { light: 'vitesse-light', dark: 'vitesse-dark' },
  /* Leave the colour to the stylesheet, which knows the deck's theme. */
  defaultColor: false,
  /* A slide never scrolls horizontally, so a code block has no reason to be a
     tab stop of its own (R5). */
  tabindex: false,
  /* A fence with no language, or one Shiki does not know, is still code. */
  defaultLanguage: 'text',
  fallbackLanguage: 'text',
  /* Load a grammar the first time a deck actually uses it. Without this,
     every bundled language is parsed up front on every build. */
  langs: [],
  lazy: true,
  transformers: [transformerCodeSteps, transformerCodeTitle]
}

/**
 * remark handles the deck's shape; rehype handles what its code looks like.
 * Both are wired in by `saburtoDecks()` in `../mdx`.
 */
export const rehypeDeckPlugins: [[typeof rehypeShiki, RehypeShikiOptions]] = [
  [rehypeShiki, shikiOptions]
]
