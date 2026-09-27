/**
 * The command line (R23): a deck file served to a browser, with no host page.
 *
 * `saburto-decks deck.mdx` compiles the deck and serves a page that renders it
 * — the same `<Deck>` a page embeds, in the whole window. The deck may also be
 * piped in (R23); a piped deck is written to a temporary file, because that is
 * what the pipeline, the includes and the watch all want. This file is all
 * server and terminal; what the page is made of is `cli/page.ts`, and what it
 * was asked for is `cli/args.ts`.
 *
 * It runs on Node, because "run it with `npx`" is the point: nothing here may
 * reach for a Bun API. What it does need is the deck's compiler, so the panel
 * of little choices below is the whole build a host would have written by
 * hand: the deck pipeline from `./mdx.ts`, and the page that imports the file.
 *
 * Vite is the server rather than a bundler: the page is a React app, and the
 * file the reader is editing — and everything it includes — is watched, so a
 * save shows up in the browser without a restart.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, fstatSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, type Plugin } from 'vite'
import { parseArgs, STDIN, usage, UsageError, type ServeOptions } from './cli/args.ts'
import { ENTRY_MODULE, pageHtml, pageSource } from './cli/page.ts'
import { saburtoDecks } from './mdx.ts'

const PROGRAM = 'saburto-decks'

/* The CLI is always run from `dist/`, and so is the component entry it serves
   to the page — they are built together. */
const built = dirname(fileURLToPath(import.meta.url))
const library = join(built, 'index.js')
const packageRoot = dirname(built)

/** The browser a reader would want opened, if they asked for one. */
function openInBrowser(url: string): void {
  const [command, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]]
  const child = spawn(command, args, { stdio: 'ignore', detached: true })
  /* A browser that will not open is not the server's problem. */
  child.on('error', () => {})
  child.unref()
}

/**
 * The page itself, served by the deck's own dev server.
 *
 * The HTML is not a file, so it is served from a middleware and handed to
 * Vite's HTML transform, which is what puts the client — and so hot reload —
 * into it. The entry module is virtual for the same reason: it is the page,
 * and there is no file for it.
 */
function pagePlugin(html: string, entry: string): Plugin {
  return {
    name: `${PROGRAM}:page`,
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = request.url ?? '/'
        const path = url.split('?')[0]
        if (path !== '/' && path !== '/index.html') return next()
        server.transformIndexHtml(url, html).then(
          (transformed) => {
            response.setHeader('Content-Type', 'text/html; charset=utf-8')
            response.end(transformed)
          },
          (error: unknown) => next(error)
        )
      })
    },
    resolveId(id) {
      return id === ENTRY_MODULE ? ENTRY_MODULE : undefined
    },
    load(id) {
      return id === ENTRY_MODULE ? entry : undefined
    }
  }
}

/**
 * React, and the package itself, wherever this copy of the CLI keeps them.
 *
 * A deck is a React component and must not meet a second React, so the page,
 * the deck and the deck's compiled output are all pointed at the one copy that
 * travels with the command — the project being served may have none at all.
 */
function aliases(): { find: RegExp; replacement: string }[] {
  const require = createRequire(import.meta.url)
  return [
    { find: /^react$/, replacement: require.resolve('react') },
    { find: /^react\/jsx-runtime$/, replacement: require.resolve('react/jsx-runtime') },
    { find: /^react\/jsx-dev-runtime$/, replacement: require.resolve('react/jsx-dev-runtime') },
    { find: /^react-dom$/, replacement: require.resolve('react-dom') },
    { find: /^react-dom\/client$/, replacement: require.resolve('react-dom/client') },
    { find: /^@saburto\/saburto-decks$/, replacement: library }
  ]
}

/**
 * Whether standard input is a deck waiting to be read: a pipe or a
 * redirection. A terminal is not one, and neither is `/dev/null` — the
 * character device a process spawned with its input ignored gets — which is
 * why this looks at the file and not only at `isTTY`.
 */
function piped(): boolean {
  if (process.stdin.isTTY) return false
  try {
    return !fstatSync(0).isCharacterDevice()
  } catch {
    return false
  }
}

/** Everything standard input has, read before the server starts. */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * A deck that arrived on standard input, put where a deck can be served from.
 *
 * The MDX pipeline, the includes and the watch all want a file in a folder, so
 * the piped deck is written to one — under a name made of its own text, so the
 * same deck served twice reuses the folder (and the compilation cache) and two
 * different decks never share one.
 */
async function stdinDeck(): Promise<string> {
  const source = await readStdin()
  if (source.trim() === '') {
    console.error(`${PROGRAM}: nothing on standard input`)
    process.exit(1)
  }
  const digest = createHash('sha1').update(source).digest('hex').slice(0, 12)
  const folder = join(tmpdir(), `${PROGRAM}-stdin`, digest)
  await mkdir(folder, { recursive: true })
  await writeFile(join(folder, 'deck.mdx'), source)
  return join(folder, 'deck.mdx')
}

async function serve(options: ServeOptions): Promise<void> {
  const pipedIn = options.deck === STDIN
  const deckFile = pipedIn ? await stdinDeck() : resolve(options.deck)
  if (!pipedIn && !existsSync(deckFile)) {
    console.error(`${PROGRAM}: no such file: ${deckFile}`)
    process.exit(1)
  }

  /* The deck's own folder is the server's root, so an include or a picture
     beside the deck is served the way the deck means it (R18). */
  const root = dirname(deckFile)
  const deckModule = `/${encodeURIComponent(basename(deckFile))}`
  const page = { name: pipedIn ? 'stdin' : basename(deckFile), deckModule, theme: options.theme }
  const cache = createHash('sha1').update(root).digest('hex').slice(0, 12)

  const server = await createServer({
    /* A host's own Vite config is not ours to obey: this is the CLI's page. */
    configFile: false,
    root,
    /* The cached optimizer must not be written into the folder being served. */
    cacheDir: join(tmpdir(), `${PROGRAM}-${cache}`),
    appType: 'custom',
    logLevel: 'warn',
    clearScreen: false,
    plugins: [saburtoDecks(), pagePlugin(pageHtml(page), pageSource(page))],
    /* The page is the only JSX in the graph; the deck's MDX compiles itself. */
    esbuild: { jsx: 'automatic' },
    resolve: { alias: aliases(), dedupe: ['react', 'react-dom'] },
    /* React is in every deck, so it is optimized before the first request
       rather than after it — the reload that would cost is visible. */
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime'
      ]
    },
    server: {
      host: options.host,
      port: options.port,
      fs: {
        /* The deck's folder, and the copy of the package this command is. */
        allow: [root, packageRoot, process.cwd()]
      }
    }
  })

  try {
    await server.listen()
  } catch (error) {
    console.error(`${PROGRAM}: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }

  const urls = server.resolvedUrls
  const local = urls?.local?.[0] ?? `http://${options.host}:${options.port}/`
  const addresses = [...(urls?.local ?? []), ...(urls?.network ?? [])]
  const shown = pipedIn ? 'stdin' : relative(process.cwd(), deckFile)

  console.log(
    [
      '',
      `${PROGRAM}  ${shown.startsWith('..') ? deckFile : shown}`,
      '',
      ...addresses.map((url) => `  ➜  ${url}`),
      '',
      '  press o to open, q to quit',
      ''
    ].join('\n')
  )

  if (options.open) openInBrowser(local)

  let closing = false
  const stop = async (): Promise<void> => {
    if (closing) return
    closing = true
    await server.close()
    process.exit(0)
  }

  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  /* On a terminal the reader quits with a key rather than a signal. Piped in,
     there is no one to press anything: the server runs until it is killed. */
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on('data', (input: Buffer) => {
      const key = input.toString()
      if (key === 'q' || key === '\u0003') void stop()
      else if (key === 'o') openInBrowser(local)
    })
  }
}

function version(): string {
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
    version: string
  }
  return manifest.version
}

const parsed = (() => {
  try {
    return parseArgs(process.argv.slice(2), { stdin: piped() })
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`${PROGRAM}: ${error.message}\n`)
      console.error(usage())
      process.exit(2)
    }
    throw error
  }
})()

if (parsed.action === 'help') console.log(usage())
else if (parsed.action === 'version') console.log(version())
else await serve(parsed.options)
