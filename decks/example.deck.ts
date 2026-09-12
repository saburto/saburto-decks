/**
 * Build entry for the example deck. Vite compiles this, the MDX file it
 * imports, and the engine into a single self-contained IIFE.
 *
 * It imports the engine from `runtime/` and not from `src/index.ts`, which
 * re-exports the build-time halves too. This file ends up in the bundle a host
 * page downloads, so nothing it can reach may be build-time code.
 */
import Deck, { frontmatter, slideCount } from './example.mdx'
import { defineDeck } from '../src/runtime/element'

defineDeck({ Component: Deck, slideCount, meta: frontmatter })
