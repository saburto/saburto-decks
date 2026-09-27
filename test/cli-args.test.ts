/**
 * The command line's grammar (R23).
 *
 * What is tested here is every decision the command makes before it starts a
 * server: which file it was pointed at, the address it will serve on, and the
 * page the reader asked for. The server itself is covered end to end.
 */
import { describe, expect, test } from 'bun:test'
import { DEFAULT_HOST, DEFAULT_PORT, parseArgs, STDIN, UsageError, usage } from '../src/cli/args'

/** The options of a `serve` command, insisting that is what was parsed. */
function serve(argv: string[], stdin = false) {
  const command = parseArgs(argv, { stdin })
  if (command.action !== 'serve') throw new Error(`expected serve, got ${command.action}`)
  return command.options
}

describe('parseArgs', () => {
  test('reads the deck file', () => {
    expect(serve(['demo.mdx']).deck).toBe('demo.mdx')
  })

  test('serves on the default address, in the default theme', () => {
    const options = serve(['demo.mdx'])
    expect(options.port).toBe(DEFAULT_PORT)
    expect(options.host).toBe(DEFAULT_HOST)
    expect(options.theme).toBe('light')
    expect(options.open).toBe(false)
  })

  test("reads a flag's value after it, and after an equals sign", () => {
    expect(serve(['--port', '5000', 'demo.mdx']).port).toBe(5000)
    expect(serve(['demo.mdx', '--port=5000']).port).toBe(5000)
    expect(serve(['--host=0.0.0.0', 'demo.mdx']).host).toBe('0.0.0.0')
    expect(serve(['demo.mdx', '--theme', 'system']).theme).toBe('system')
  })

  test('opens the browser only when asked', () => {
    expect(serve(['-o', 'demo.mdx']).open).toBe(true)
    expect(serve(['demo.mdx', '--open']).open).toBe(true)
  })

  test('takes the deck file in any position among the flags', () => {
    const options = serve(['--theme=dark', 'decks/demo.mdx', '--port', '8000'])
    expect(options.deck).toBe('decks/demo.mdx')
    expect(options.theme).toBe('dark')
    expect(options.port).toBe(8000)
  })

  test('stops reading flags at --, so a deck may be called --port', () => {
    expect(serve(['--', '--port']).deck).toBe('--port')
  })

  test('answers --help and --version before anything else', () => {
    expect(parseArgs(['-h']).action).toBe('help')
    expect(parseArgs(['--help']).action).toBe('help')
    expect(parseArgs(['--version']).action).toBe('version')
  })

  test('refuses a second deck', () => {
    expect(() => parseArgs(['one.mdx', 'two.mdx'])).toThrow(UsageError)
  })

  test('refuses to serve nothing', () => {
    expect(() => parseArgs([])).toThrow(/deck file is required/)
  })

  test('reads the deck from standard input when it is named as -', () => {
    expect(serve(['-']).deck).toBe(STDIN)
    expect(serve(['--port', '5000', '-'], true).deck).toBe(STDIN)
    expect(serve(['--', '-']).deck).toBe(STDIN)
  })

  test('reads a piped deck when no file was named', () => {
    expect(serve([], true).deck).toBe(STDIN)
    expect(serve(['--theme', 'dark'], true).deck).toBe(STDIN)
  })

  test('reads the file, not the pipe, when both are there', () => {
    expect(serve(['demo.mdx'], true).deck).toBe('demo.mdx')
  })

  test('refuses a port that is not one, and a theme that does not exist', () => {
    expect(() => parseArgs(['demo.mdx', '--port', 'soon'])).toThrow(/not a port/)
    expect(() => parseArgs(['demo.mdx', '--port=0'])).toThrow(/not a port/)
    expect(() => parseArgs(['demo.mdx', '--port=70000'])).toThrow(/not a port/)
    expect(() => parseArgs(['demo.mdx', '--theme=sepia'])).toThrow(/not a theme/)
  })

  test('refuses a flag it does not know, and a flag left without a value', () => {
    expect(() => parseArgs(['demo.mdx', '--loud'])).toThrow(/unknown option/)
    expect(() => parseArgs(['demo.mdx', '--port'])).toThrow(/needs a value/)
  })

  test('the help text names the program, the file and the options', () => {
    const text = usage()
    expect(text).toContain('saburto-decks <deck.mdx>')
    expect(text).toContain('standard input')
    expect(text).toContain('--port')
    expect(text).toContain('--theme')
    expect(text).toContain('--open')
  })
})
