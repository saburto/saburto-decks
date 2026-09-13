#!/usr/bin/env bun
/**
 * A development tool: print what a deck file compiles to.
 *
 * `test/deck-compile.test.ts` asserts on the compiled output; it cannot show
 * it to you. When a plug-in mangles something — a `---` that becomes a heading
 * instead of a slide break, a fence the highlighter does not recognise, a
 * `<Mark>` that comes through as raw markup — this is the view that says why.
 * It runs the same two pipelines the real build runs, in the real order.
 *
 *   bun run compile                              # decks/example.mdx
 *   bun run compile decks/example.mdx --grep Mark
 *   bun run compile decks/example.mdx --out /tmp/deck.js
 *
 * Without `--grep` the whole compiled module goes to stdout; with it, only the
 * lines containing the substring.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compile } from '@mdx-js/mdx'
import { remarkDeckPlugins } from '../src/build/remark-plugins.ts'
import { rehypeDeckPlugins } from '../src/build/rehype-plugins.ts'

const argv = process.argv.slice(2).filter((argument) => argument !== '--')

const flag = (name: string): string | undefined => {
  const at = argv.indexOf(name)
  return at === -1 ? undefined : argv[at + 1]
}

const file = argv.find((argument) => !argument.startsWith('-')) ?? 'decks/example.mdx'
const grep = flag('--grep')
const out = flag('--out')

let source: string
try {
  source = readFileSync(resolve(file), 'utf8')
} catch {
  console.error(`compile: cannot read ${resolve(file)}`)
  process.exit(1)
}

const compiled = await compile(source, {
  remarkPlugins: remarkDeckPlugins,
  rehypePlugins: rehypeDeckPlugins
})

let output = String(compiled.value)
if (grep) {
  const lines = output.split('\n').filter((line) => line.includes(grep))
  output = lines.join('\n')
  console.error(`${lines.length} line(s) matching "${grep}" in ${file}`)
}

if (out) {
  writeFileSync(resolve(out), output)
  console.error(`written ${resolve(out)} (${output.length} bytes)`)
} else {
  console.log(output)
}
