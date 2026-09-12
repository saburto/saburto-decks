/**
 * The component a host page renders.
 *
 * Deliberately free of build-time code: this is what ends up in the page's
 * JavaScript, so nothing here may reach for `@mdx-js/rollup` or remark. The
 * build half lives in `./mdx`.
 */
export { Deck, type DeckHandle, type DeckProps } from './runtime/Deck'
export { Slide, type DeckComponent, type DeckMode, type DeckTheme } from './runtime/Slide'
