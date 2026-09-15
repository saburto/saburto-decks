import DeckHost from './DeckHost.tsx'
import slides from '../../../decks/slidedocs.mdx'

/**
 * The Astro page's interactive part: the example deck, driven by the page.
 *
 * An island, because a deck is interactive. Everything here is what a host
 * page does with a deck — nothing about the deck's internals.
 */
export default function DeckDemo() {
  return <DeckHost slides={slides} />
}
