/**
 * What a key means (R12, R17, N1), as a decision separate from the DOM.
 *
 * A deck has two keyboards: the deck's own, and the contents' while they are
 * open. Both are described here as pure functions of the key and a little
 * state — which is what lets the rules be tested without a browser — and the
 * hook in `useDeckKeyboard` is what carries them out.
 *
 * The contents' rules matter because, while they are open, the reader is
 * choosing a slide rather than stepping through one: navigation keys do not
 * reach the deck, and Tab stays within the contents until they are dismissed.
 */

/** What the deck should do about a key. */
export type DeckCommand =
  | { kind: 'exit' }
  | { kind: 'contents' }
  | { kind: 'next' }
  | { kind: 'prev' }
  | { kind: 'first' }
  | { kind: 'last' }
  | { kind: 'tab' }
  | { kind: 'none' }

/**
 * The deck's own keyboard. Escape only leaves present mode — the deck is part
 * of the page while embedded, and must not swallow the page's Escape. Tab is a
 * command because it means something different in each mode: while presenting
 * focus is contained; embedded, it is left to the page (N1).
 */
export function deckCommand(key: string, presenting: boolean): DeckCommand {
  switch (key) {
    case 'Escape':
      return presenting ? { kind: 'exit' } : { kind: 'none' }
    case 'o':
    case 'O':
      return { kind: 'contents' }
    case 'ArrowRight':
    case 'ArrowDown':
    case 'PageDown':
    case ' ':
      return { kind: 'next' }
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
      return { kind: 'prev' }
    case 'Home':
      return { kind: 'first' }
    case 'End':
      return { kind: 'last' }
    case 'Tab':
      return { kind: 'tab' }
    default:
      return { kind: 'none' }
  }
}

/** What the contents should do about a key. */
export type ContentsCommand =
  { kind: 'close' } | { kind: 'focus'; entry: number } | { kind: 'tab' } | { kind: 'none' }

/**
 * The contents' own keyboard. `active` is the focused entry's index, or -1
 * when none of them holds focus; `entryCount` is how many slides there are.
 * Arrow keys move through the entries and stop at the ends; Tab wraps within
 * the contents, because they are one control until dismissed (R17, N1).
 */
export function contentsCommand(key: string, active: number, entryCount: number): ContentsCommand {
  switch (key) {
    case 'Escape':
    case 'o':
    case 'O':
      return { kind: 'close' }
    case 'Tab':
      return { kind: 'tab' }
    case 'ArrowDown':
      return entryCount === 0
        ? { kind: 'none' }
        : { kind: 'focus', entry: Math.min(active + 1, entryCount - 1) }
    case 'ArrowUp':
      return entryCount === 0 ? { kind: 'none' } : { kind: 'focus', entry: Math.max(active - 1, 0) }
    case 'Home':
      return entryCount === 0 ? { kind: 'none' } : { kind: 'focus', entry: 0 }
    case 'End':
      return entryCount === 0 ? { kind: 'none' } : { kind: 'focus', entry: entryCount - 1 }
    default:
      return { kind: 'none' }
  }
}
