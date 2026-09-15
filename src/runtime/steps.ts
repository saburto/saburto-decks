/**
 * The deck's step model (R12, R14, R15, R16): every rule about steps lives
 * here and nowhere else.
 *
 * Three things make up a step, and each is a function of its own so it can be
 * reasoned about without a browser:
 *
 * - **How many** a slide has. Content that steps carries `data-steps`, the
 *   number of states it can be in; a slide's steps are the most any one piece
 *   of its content has, and a slide with none still has the one state it
 *   arrives in.
 * - **Which position** the reader moves to. Next walks a slide's steps before
 *   it leaves the slide; previous walks them back and steps onto the last step
 *   of the slide before, so the reader always moves one position, never two.
 * - **How a step is shown**. Code blocks, diagrams, annotations and moving
 *   objects each show a step their own way, so each is a `StepSource`; the
 *   deck only has to hand the active slide and the reader's step to all of
 *   them. Adding a step-bearing kind of content is one source here and nothing
 *   in the deck.
 *
 * Nothing in this file touches React or a shadow root: the DOM functions take
 * plain elements, and the decisions they make are separate, pure functions.
 */

/**
 * The step a piece of step-driven content happens on, 1-based (R12).
 *
 * A code block and a diagram declare their steps while the deck is compiled,
 * but content that is a React component — an annotation (R15), an object that
 * appears or moves (R16) — is written by the deck's author and counts its own.
 * `at` is what the author wrote; anything unreadable, or nothing at all, means
 * "with the slide", which is step 1.
 */
export function stepAt(at: number | string | undefined): number {
  const value = Math.round(Number(at ?? 1))
  return Number.isFinite(value) && value >= 1 ? value : 1
}

/* -------------------------------------------------------------------------- */
/* The reader's position                                                       */
/* -------------------------------------------------------------------------- */

/** Where the reader is: a slide, and a step within it. Both zero-based. */
export interface Position {
  index: number
  step: number
}

/** How many steps the slide at `index` has, at least one. */
export type StepsAt = (index: number) => number

/**
 * The nearest position the deck actually has: the slide clamped to the deck,
 * the step clamped to that slide. A deck with no slides has one position, at
 * the start.
 */
export function resolvePosition(request: Position, count: number, stepsAt: StepsAt): Position {
  if (count <= 0) return { index: 0, step: 0 }
  const index = Math.max(0, Math.min(request.index, count - 1))
  const step = Math.max(0, Math.min(request.step, stepsAt(index) - 1))
  return { index, step }
}

/**
 * One step onwards: the next step of the slide, or the first step of the next
 * slide once the last one has been shown. At the end of the deck, no further
 * position exists.
 */
export function stepForward(position: Position, count: number, stepsAt: StepsAt): Position {
  if (position.step < stepsAt(position.index) - 1) {
    return { index: position.index, step: position.step + 1 }
  }
  if (position.index < count - 1) return { index: position.index + 1, step: 0 }
  return position
}

/**
 * One step back: the previous step of the slide, or the last step of the slide
 * before once the slide's first step is reached. Reverses `stepForward`
 * exactly.
 */
export function stepBack(position: Position, count: number, stepsAt: StepsAt): Position {
  if (position.step > 0) return { index: position.index, step: position.step - 1 }
  if (position.index > 0) {
    return { index: position.index - 1, step: Math.max(0, stepsAt(position.index - 1) - 1) }
  }
  return position
}

/* -------------------------------------------------------------------------- */
/* How many steps                                                            */
/* -------------------------------------------------------------------------- */

/** The attribute every piece of step-driven content carries its step count
 * on. */
export const STEPS_ATTRIBUTE = 'data-steps'

/** How many steps a slide has: the most any of its step-driven content has. A
 * slide with none still has the one state it arrives in. */
export function countSteps(slide: Element | null | undefined): number {
  if (!slide) return 1
  let steps = 1
  for (const element of slide.querySelectorAll(`[${STEPS_ATTRIBUTE}]`)) {
    steps = Math.max(steps, readCount(element))
  }
  return steps
}

/* -------------------------------------------------------------------------- */
/* How a step is shown                                                        */
/* -------------------------------------------------------------------------- */

/**
 * One kind of step-driven content: how it is shown, and which of a slide's
 * elements it is shown on. The deck applies a step by handing it to every
 * source; the source then touches only its own elements.
 */
export interface StepSource {
  /** The elements of the active slide this source shows steps on. */
  readonly selector: string
  /** Show `step` on one of them. `step` is already clamped to the element. */
  apply(root: HTMLElement, step: number): void
}

/**
 * Shows `step` on every piece of step-driven content of the active slide
 * (R12, R14). It is the deck's single entry point: a source that is not in
 * this list is content the deck does not step.
 */
export function applySteps(slide: Element | null | undefined, step: number): void {
  if (!slide) return
  for (const source of STEP_SOURCES) {
    for (const root of slide.querySelectorAll<HTMLElement>(source.selector)) {
      source.apply(root, Math.min(step, readCount(root) - 1))
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Code blocks                                                                */
/* -------------------------------------------------------------------------- */

/** How a code block shows one step (R11, R12). */
export interface CodeBlockState {
  /** The step actually shown: a step past the last one shows the last. */
  at: number
  /** Whether the block, and the title bar above it, is taken off the slide. */
  hidden: boolean
  /** Whether the block dims the lines the step does not name. Only a hidden
   * step has nothing to say about dimming. */
  dims: boolean
}

/** The state a code block is in at `step`, from the steps it declares. */
export function codeBlockState(
  total: number,
  hide: readonly number[],
  step: number
): CodeBlockState {
  const at = Math.max(0, Math.min(step, total - 1))
  const hidden = hide.includes(at)
  return { at, hidden, dims: !hidden }
}

/**
 * Whether a line is lit at this step: never while the block is off the slide,
 * and otherwise when the step is one of the `data-hl` steps the line carries.
 */
export function lineHighlighted(highlight: readonly number[], state: CodeBlockState): boolean {
  return !state.hidden && highlight.includes(state.at)
}

/**
 * A `{hide}` step takes a code block, and the title bar above it, off the
 * slide — nothing about it is left behind.
 */
function setCodeHidden(block: HTMLElement, hidden: boolean): void {
  block.hidden = hidden
  const title = block.previousElementSibling
  if (title instanceof HTMLElement && title.classList.contains('sd-code-title'))
    title.hidden = hidden
}

/** Shows `step` on a Shiki-highlighted code block. */
function applyCodeStep(block: HTMLElement, step: number): void {
  const state = codeBlockState(readCount(block), numberList(block, 'data-hide'), step)
  setCodeHidden(block, state.hidden)
  for (const line of block.querySelectorAll<HTMLElement>('.line')) {
    line.classList.toggle('highlighted', lineHighlighted(numberList(line, 'data-hl'), state))
  }
  block.classList.toggle('has-highlighted', state.dims)
}

/** The code block source: Shiki's own markup, as the build left it. */
const CODE_SOURCE: StepSource = {
  selector: `pre.shiki[${STEPS_ATTRIBUTE}]`,
  apply: applyCodeStep
}

/* -------------------------------------------------------------------------- */
/* Diagrams                                                                   */
/* -------------------------------------------------------------------------- */

/** Which class a diagram element carries at a step, and whether it has it. A
 * diagram revealed element by element shows the elements up to the current
 * step; one shown whole and built keeps every element and brings the current
 * step's part forward (R14). */
export interface DiagramVisibility {
  className: 'sd-shown' | 'sd-current'
  on: boolean
}

/** How one marked element of a diagram is shown at `at`. */
export function diagramVisibility(
  elementStep: number,
  at: number,
  built: boolean
): DiagramVisibility {
  return built
    ? { className: 'sd-current', on: elementStep === at }
    : { className: 'sd-shown', on: elementStep <= at }
}

/** Shows `step` on a diagram the build marked with its elements' steps. */
function applyDiagramStep(diagram: HTMLElement, step: number): void {
  const built = diagram.hasAttribute('data-build')
  for (const element of diagram.querySelectorAll<SVGElement>('[data-sd-step]')) {
    const visibility = diagramVisibility(Number(element.getAttribute('data-sd-step')), step, built)
    element.classList.toggle(visibility.className, visibility.on)
  }
}

/** The diagram source: the elements `mermaid-steps` marked while drawing
 * (R13, R14). */
const DIAGRAM_SOURCE: StepSource = {
  selector: `.sd-mermaid[${STEPS_ATTRIBUTE}]`,
  apply: applyDiagramStep
}

/**
 * Every kind of content the deck shows steps on. Annotations (R15) and moving
 * objects (R16) step themselves, from the same `SlideContext`, so they are not
 * here: they have no markup for the deck to toggle.
 */
export const STEP_SOURCES: readonly StepSource[] = [CODE_SOURCE, DIAGRAM_SOURCE]

/* -------------------------------------------------------------------------- */
/* Reading the markup                                                         */
/* -------------------------------------------------------------------------- */

/** The step count on an element, never less than one. */
function readCount(element: Element): number {
  return Math.max(1, Number(element.getAttribute(STEPS_ATTRIBUTE)) || 1)
}

/** A space-separated list of numbers on an element, empty when there is none. */
function numberList(element: Element, name: string): number[] {
  const value = element.getAttribute(name)
  if (!value) return []
  return value
    .split(' ')
    .filter((part) => part !== '')
    .map(Number)
}
