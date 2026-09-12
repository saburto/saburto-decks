/**
 * Serves the demo host page and the built deck bundles.
 *
 * Embedding is meant to work from static files (R4), so this is deliberately
 * the smallest thing that can do it: no framework, no transform. It is also
 * the web server the end-to-end tests run against, and a way to serve it
 * to another machine.
 *
 *   bun run scripts/serve.ts                  # http://127.0.0.1:4173/demo/
 *   HOST=0.0.0.0 bun run scripts/serve.ts     # also reachable from the network
 */
import { networkInterfaces } from 'node:os'
import { join, resolve } from 'node:path'

const port = Number(process.env['PORT'] ?? 4173)
/* Localhost by default. Opt in to the network with HOST=0.0.0.0 (or
   HOST=<your LAN address>). */
const hostname = process.env['HOST'] ?? '127.0.0.1'
const root = resolve(process.cwd())

const server = Bun.serve({
  port,
  hostname,
  async fetch(request) {
    const url = new URL(request.url)
    const pathname = decodeURIComponent(url.pathname)

    const target = resolve(join(root, pathname))
    /* Nothing outside the project directory, whatever the URL claims. */
    if (target !== root && !target.startsWith(root + '/')) {
      return new Response('forbidden', { status: 403 })
    }

    const file = Bun.file(pathname.endsWith('/') ? join(target, 'index.html') : target)
    if (await file.exists()) return new Response(file)

    /* Directory without a trailing slash. */
    const index = Bun.file(join(target, 'index.html'))
    if (await index.exists()) return new Response(index)

    return new Response('not found', { status: 404 })
  }
})

const addresses = [
  `http://localhost:${server.port}/demo/`,
  ...(hostname === '127.0.0.1'
    ? []
    : Object.values(networkInterfaces())
        .flat()
        .filter((iface) => iface?.family === 'IPv4' && !iface.internal)
        .map((iface) => `http://${iface?.address}:${server.port}/demo/`))
]

console.log(`serving ${root}`)
for (const address of addresses) console.log(`  ${address}`)
