# AGENTS.md

Embeddable slide decks authored in MDX: read inline inside an existing HTML page, presented
full screen. See [PLAN.md](PLAN.md).

## Rules

- **PLAN.md is requirements-level only.** No stack details, file layouts, code samples, API
  signatures, or implementation steps. State what the product must do, not how.
- **Scope is deliberately minimal:** slides of simple text. Do not add features, dependencies,
  files, or documents that were not asked for.
- **Fixed stack:** Bun (runner), Vite (builder), React + MDX (authoring). One package,
  `@saburto/saburto-decks`.
