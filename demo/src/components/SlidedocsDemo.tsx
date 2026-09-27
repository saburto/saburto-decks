import DeckHost from './DeckHost.tsx'
import slides from '../../../decks/slidedocs.mdx'

/**
 * A second deck, on a second page, through the same component.
 *
 * Nothing about the host changes for it: a different deck file is a different
 * import, and the deck the page gets is a different React component.
 */
export default function SlidedocsDemo() {
  return <DeckHost slides={slides} />
}
