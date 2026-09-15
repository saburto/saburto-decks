/**
 * The component a host page renders.
 *
 * Deliberately free of build-time code: this is what ends up in the page's
 * JavaScript, so nothing here may reach for `@mdx-js/rollup` or remark. The
 * build half lives in `./mdx`.
 */
export { Deck, type DeckHandle, type DeckProps } from './runtime/Deck'
export { Bullets, type BulletsProps } from './runtime/Bullets'
export { Block, type BlockProps } from './runtime/Block'
export { Canvas, type CanvasProps } from './runtime/Canvas'
export { Cover, type CoverProps } from './runtime/Cover'
export { Figure, type FigureProps } from './runtime/Figure'
export { Grid, type GridProps } from './runtime/Grid'
export { Agenda, type AgendaProps } from './runtime/Agenda'
export { Arrow, type ArrowProps } from './runtime/Arrow'
export { Columns, type ColumnsProps } from './runtime/Columns'
export { Stack, type StackProps } from './runtime/Stack'
export { Stage, type StageProps } from './runtime/Stage'
export { Slide, type DeckComponent, type DeckMode, type DeckTheme } from './runtime/Slide'
export { Slides, type SlidesProps } from './runtime/Slides'
