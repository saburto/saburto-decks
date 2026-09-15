/**
 * The file another deck included, rendered where its author put the include
 * (R18).
 *
 * `remark-imports` turns `<Slides src="./part.mdx" />` into an import of that
 * file plus this element, and hands it the compiled module as `src`. Which of
 * the two things it is — the included file's slides, or its content inside a
 * slide — is decided by where the element sits, and the runtime only has to
 * pass the deck's own components to the module and tell it where its slides
 * begin.
 *
 * The components come from the deck's context rather than from the element,
 * so an included file's `<Columns>` is the deck's `<Columns>` and not a
 * declared name MDX cannot find.
 */
import { createContext, useContext, type ComponentType } from 'react'
import { SlideOffsetContext } from './Slide'

/** The components a deck renders every one of its MDX modules with. */
export type DeckComponents = Record<string, ComponentType<any>>

/** The deck's components, for the modules that have to render other modules. */
export const DeckComponentsContext = createContext<DeckComponents | null>(null)

export interface SlidesProps {
  /** The compiled file this include resolved to. */
  src: ComponentType<Record<string, unknown>>
  /** Where its slides begin in the deck, counted by the build (R18). */
  offset?: number | string
}

export function Slides({ src: Included, offset = 0 }: SlidesProps) {
  const components = useContext(DeckComponentsContext)
  const outer = useContext(SlideOffsetContext)
  const start = outer + (Number(offset) || 0)

  return (
    <SlideOffsetContext.Provider value={start}>
      <Included components={components ?? {}} />
    </SlideOffsetContext.Provider>
  )
}

export default Slides
