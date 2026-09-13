/**
 * Which step reveals which part of a diagram (R14).
 *
 * The plan is read off the drawing Mermaid actually made, never off its
 * source: Mermaid numbers or groups the parts it draws in the order the author
 * declared them, so the drawing already carries that order.
 *
 * - A sequence diagram names a top participant box `root-N`, that
 *   participant's lifeline `actorN`, and each message or note `iN`, numbered
 *   across the whole diagram.
 * - A flowchart lists its nodes in `g.nodes` in declaration order, and its
 *   edges in `g.edgePaths`, also in declaration order.
 *
 * A diagram of any other kind gets no marks at all and is therefore shown
 * whole, as one step (R13).
 */

/** A sequence diagram's participant box (the numbered `root-N` group). */
const PARTICIPANT = 'g[data-et="participant"]'

/** A participant's dashed lifeline. */
const LIFELINE = '[data-et="life-line"][data-id]'

/**
 * A sequence diagram's timed elements: a message or a note. A `loop` or `alt`
 * frame is deliberately not marked — Mermaid numbers it after the contents it
 * encloses, and a frame appearing last would read backwards — so it stays
 * visible and its contents fill in inside it.
 */
const EVENT = '[data-et="message"][data-id], [data-et="note"][data-id]'

/** A flowchart's node, in declaration order. */
const FLOWCHART_NODE = 'g.nodes g.node'

/** A flowchart's edge, in declaration order. */
const FLOWCHART_EDGE = 'g.edgePaths path'

/** An edge's label, which Mermaid draws apart from the edge itself. */
const EDGE_LABEL = 'g.edgeLabels .label[data-id]'

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

/**
 * The label Mermaid drew for an edge, found by the edge's own id: the label's
 * `data-id` is the edge id without the diagram's id in front of it. An
 * unlabeled edge has none, which is why the two cannot be paired by position.
 */
function edgeLabelFor(svg: Element, edge: Element): Element | null {
  const id = edge.id
  if (!id) return null
  const label = Array.from(svg.querySelectorAll(EDGE_LABEL)).find((candidate) => {
    const link = candidate.getAttribute('data-id') ?? ''
    return link !== '' && (id === link || id.endsWith(`-${link}`))
  })
  return label?.closest('g.edgeLabel') ?? label ?? null
}

/**
 * Marks every node of a flowchart, then every edge, with the step that reveals
 * it — the same shape as a sequence diagram's participants and then its
 * messages — and returns how many steps there are.
 */
export function assignFlowchartSteps(svg: Element): number {
  const nodes = Array.from(svg.querySelectorAll(FLOWCHART_NODE))
  const edges = Array.from(svg.querySelectorAll(FLOWCHART_EDGE))
  if (nodes.length === 0 && edges.length === 0) return 1

  let step = 0
  const mark = (element: Element | null | undefined) => {
    if (element) element.setAttribute(REVEAL_ATTRIBUTE, String(step))
  }

  for (const node of nodes) {
    mark(node)
    step++
  }
  for (const edge of edges) {
    mark(edge)
    mark(edgeLabelFor(svg, edge))
    step++
  }

  return Math.max(1, step)
}

/**
 * Marks a diagram's parts with the step that reveals each, and returns how
 * many steps there are. A diagram whose kind does not step — or an empty one —
 * is a single step.
 */
export function assignDiagramSteps(svg: Element): number {
  if (svg.classList.contains('flowchart')) return assignFlowchartSteps(svg)
  if (svg.querySelector(PARTICIPANT) || svg.querySelector(EVENT)) return assignSequenceSteps(svg)
  return 1
}
