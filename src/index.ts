/**
 * The package's surface: everything, in one place.
 *
 * Note what that costs. This module re-exports both halves of the source, so
 * anything importing it reaches build-time code as well as the deck itself.
 * A shipped entry point must therefore import from `runtime/` directly — as
 * `decks/example.deck.ts` does — so that what a host page downloads cannot
 * reach `build/` at all. That separation is the reason for the two folders,
 * and importing this barrel from a bundle entry would quietly undo it.
 */
export {
  SaburtoDeckElement,
  defineDeck,
  MODE_CHANGE_EVENT,
  TAG_NAME,
  type DeckModule
} from './runtime/element'
export { DeckView, Slide, type DeckMode, type DeckComponent } from './runtime/deck'
export { remarkSlides, splitSlides, type MdastNode } from './build/remark-slides'
