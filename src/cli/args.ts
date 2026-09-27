/**
 * What the command line was asked to do (R23).
 *
 * Kept apart from the server so the grammar can be read — and tested — without
 * one: one deck, from a file or from standard input, and the few choices a
 * reader makes about the address it is served on and the page that shows it.
 */
import type { DeckTheme } from '../runtime/Slide'

/** What `serve` needs to know. */
export interface ServeOptions {
  /** The deck file, as the reader typed it; {@link STDIN} means standard input. */
  deck: string
  /** The port to serve on. */
  port: number
  /** The address to bind, so a deck can be shown on another device. */
  host: string
  /** Whether to open the browser once the server answers. */
  open: boolean
  /** Which theme the served page starts in, before the reader's own choice. */
  theme: DeckTheme
}

export type Command =
  { action: 'serve'; options: ServeOptions } | { action: 'help' } | { action: 'version' }

export const DEFAULT_PORT = 4173
export const DEFAULT_HOST = '127.0.0.1'
export const DEFAULT_THEME: DeckTheme = 'light'
export const THEMES: readonly DeckTheme[] = ['light', 'dark', 'system']

/** The deck file that is not a file: what the reader types, and `parseArgs`
 * reports, for a deck arriving on standard input. */
export const STDIN = '-'

export interface ParseOptions {
  /** Whether standard input could be a deck — a pipe or a redirection, and no
   * file named. A terminal, or nothing at all, is not a deck. */
  stdin?: boolean
}

/** Thrown for anything the reader can put right by typing it differently. */
export class UsageError extends Error {}

export function usage(): string {
  return `saburto-decks — serve a deck file to a browser (R23)

  saburto-decks <deck.mdx> [options]

  The deck may also arrive on standard input, named by - or piped in with no
  file at all:

  saburto-decks - [options] < deck.mdx
  cat deck.mdx | saburto-decks [options]

  --port <number>   the port to serve on (default ${DEFAULT_PORT})
  --host <name>     the address to bind (default ${DEFAULT_HOST}; 0.0.0.0 for the network)
  --theme <name>    light, dark or system (default ${DEFAULT_THEME})
  -o, --open        open the browser once the server is up
  -h, --help        this text
  --version         the version

  With the server running, press o to open the browser, q to quit.
`
}

function port(raw: string): number {
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new UsageError(`not a port: ${raw}`)
  }
  return value
}

function theme(raw: string): DeckTheme {
  if (!THEMES.includes(raw as DeckTheme)) {
    throw new UsageError(`not a theme: ${raw} (${THEMES.join(', ')})`)
  }
  return raw as DeckTheme
}

/** Parses `process.argv.slice(2)`, in the order a reader would type it. */
export function parseArgs(argv: string[], { stdin = false }: ParseOptions = {}): Command {
  let deck: string | undefined
  let port_ = DEFAULT_PORT
  let host = DEFAULT_HOST
  let chosen = DEFAULT_THEME
  let open = false
  let flags = true

  /* A flag's value is either the rest of the same argument (`--port=5000`) or
     the argument after it. */
  const value = (at: number, name: string): [string, number] => {
    const argument = argv[at] as string
    const equals = argument.indexOf('=')
    if (equals !== -1) return [argument.slice(equals + 1), at]
    const next = argv[at + 1]
    if (next === undefined || (next.startsWith('-') && next !== '-')) {
      throw new UsageError(`${name} needs a value`)
    }
    return [next, at + 1]
  }

  for (let at = 0; at < argv.length; at++) {
    const argument = argv[at] as string
    if (flags && argument === '--') {
      flags = false
      continue
    }

    if (!flags || !argument.startsWith('-') || argument === '-') {
      if (deck !== undefined) throw new UsageError('one deck at a time')
      deck = argument
      continue
    }

    const equals = argument.indexOf('=')
    const name = equals === -1 ? argument : argument.slice(0, equals)
    switch (name) {
      case '-h':
      case '--help':
        return { action: 'help' }
      case '--version':
        return { action: 'version' }
      case '-o':
      case '--open':
        open = true
        break
      case '--port': {
        const [raw, end] = value(at, name)
        at = end
        port_ = port(raw)
        break
      }
      case '--host': {
        const [raw, end] = value(at, name)
        at = end
        if (raw === '') throw new UsageError('--host needs a value')
        host = raw
        break
      }
      case '--theme': {
        const [raw, end] = value(at, name)
        at = end
        chosen = theme(raw)
        break
      }
      default:
        throw new UsageError(`unknown option ${name}`)
    }
  }

  if (deck === undefined) {
    if (!stdin) throw new UsageError('a deck file is required')
    deck = STDIN
  }
  return { action: 'serve', options: { deck, port: port_, host, open, theme: chosen } }
}
