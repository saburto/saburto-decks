/**
 * The components every MDX module a deck renders resolves against — the deck's
 * own file and the files it includes alike (R18).
 *
 * The map is defined once here rather than inside `Deck`, so that adding a
 * component is a change to this file and to `../index.ts` and nothing else:
 * the deck imports it, and so does any future renderer of a deck.
 */
import { Slide } from './Slide'
import { Contents } from './Contents'
import { Agenda } from './Agenda'
import { Arrow } from './Arrow'
import { Block } from './Block'
import { Bullets } from './Bullets'
import { Canvas } from './Canvas'
import { Columns } from './Columns'
import { Cover } from './Cover'
import { Figure } from './Figure'
import { Grid } from './Grid'
import { Mark } from './Mark'
import { Mermaid } from './Mermaid'
import { Appear, Move } from './Motion'
import { Slides } from './Slides'
import { Stack } from './Stack'
import type { DeckComponents } from './Slides'

export const deckComponents: DeckComponents = {
  Slide,
  Mermaid,
  Mark,
  Arrow,
  Appear,
  Move,
  Canvas,
  Cover,
  Agenda,
  Columns,
  Grid,
  Block,
  Stack,
  Figure,
  Bullets,
  Contents,
  Slides
}
