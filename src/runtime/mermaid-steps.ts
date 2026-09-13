/**
 * Which step reveals which part of a sequence diagram (R14).
 *
 * Mermaid writes the diagram's own declaration order onto the drawing it
 * produces: a top participant box is `root-N`, that participant's lifeline is
 * `actorN`, and every message or note is `iN`, numbered across the whole
 * diagram. Nothing here parses Mermaid's syntax; the plan is read off the
 * drawing Mermaid actually made, so it stays true for whatever the author
 * used — aliases, self-messages, notes and all.
 *
 * Only sequence diagrams carry that numbering. A flowchart, a pie chart or
 * anything else gets no marks at all and is therefore shown whole, as one
 * step (R13).
 */

/** A participant box (the numbered `root-N` group). */
const PARTICIPANT = 'g[data-et="participant"]'

/** A participant's dashed lifeline. */
const LIFELINE = '[data-et="life-line"][data-id]'

/**
 * Something that happens in time order: a message or a note. A `loop` or
 * `alt` frame is deliberately not marked — Mermaid numbers it after the
 * contents it encloses, and a frame appearing last would read backwards — so
 * it stays visible and its contents fill in inside it.
 */
const EVENT = '[data-et="message"][data-id], [data-et="note"][data-id]'

/** The attribute the deck toggles to reveal an element at its step. */
const REVEAL_ATTRIBUTE = 'data-sd-step'

/** The `N` of a `root-N` or `iN` name, or `null` when the name has none. */
function sequenceNumber(element: Element, pattern: RegExp): number | null {
  const name = element.id || element.getAttribute('data-id') || ''
  const match = pattern.exec(name)
  return match ? Number(match[1]) : null
}

function lifelineFor(svg: Element, id: string): Element | null {
  return (
    Array.from(svg.querySelectorAll(LIFELINE)).find((line) => line.getAttribute('data-id') === id) ?? null
  )
}

/**
 * The bottom copy of a participant, if the diagram mirrors its actors. Mermaid
 * has named that box after the participant's id in some versions and after its
 * display name in others, so either match is accepted.
 */
function bottomActorFor(svg: Element, id: string, label: string): Element | null {
  const boxes = Array.from(svg.querySelectorAll('rect.actor-bottom'))
  const box =
    boxes.find((rect) => rect.getAttribute('name') === id) ??
    boxes.find((rect) => rect.getAttribute('name') === label)
  return box?.parentElement ?? null
}

/**
 * Marks every element of a sequence drawing with the step that reveals it and
 * returns how many steps there are. A drawing with no sequence elements — not
 * a sequence diagram, or an empty one — is a single step.
 */
export function assignSequenceSteps(svg: Element): number {
  const participants = Array.from(svg.querySelectorAll(PARTICIPANT))
  const events = Array.from(svg.querySelectorAll(EVENT))
  if (participants.length === 0 && events.length === 0) return 1

  /* The diagram's declaration order is its `N`, not its document order: the
     SVG lists a later participant first (R14). */
  const rank = (element: Element) => sequenceNumber(element, /^root-(\d+)$/) ?? Number.MAX_SAFE_INTEGER
  participants.sort((a, b) => rank(a) - rank(b))

  let step = 0
  const mark = (element: Element | null | undefined) => {
    if (element) element.setAttribute(REVEAL_ATTRIBUTE, String(step))
  }

  for (const participant of participants) {
    const id = participant.getAttribute('data-id') ?? ''
    mark(participant)
    /* The lifeline and the top box share a group; revealing the group reveals
       both, and the bottom copy is revealed with them. */
    mark(participant.parentElement)
    mark(lifelineFor(svg, id))
    mark(bottomActorFor(svg, id, participant.textContent?.trim() ?? ''))
    step++
  }

  const ordered = events
    .map((element) => ({ element, order: sequenceNumber(element, /^i(\d+)$/) }))
    .filter((entry): entry is { element: Element; order: number } => entry.order !== null)
    .sort((a, b) => a.order - b.order)

  /* A message's label is a separate element from its line, in the same order.
     Pairing them by that order keeps the two revealed together. */
  const labels = Array.from(svg.querySelectorAll('text.messageText'))
  let message = 0
  for (const { element } of ordered) {
    mark(element)
    if (element.getAttribute('data-et') === 'message') mark(labels[message++])
    step++
  }

  return Math.max(1, step)
}
