/**
 * The deck's stylesheet, as one string.
 *
 * Tailwind compiles `tailwind.css` — the theme, the utilities the deck's own
 * components use, and the small set of rules Tailwind cannot express — and
 * `?inline` hands it back as a string. The string is injected into the deck's
 * shadow root, which is what keeps the deck's styling out of the host page and
 * the host page's styling out of the deck (R8).
 */
import css from './tailwind.css?inline'

export const deckStyles: string = css
