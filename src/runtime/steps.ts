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
