/**
 * Including another file's slides (R18), tested at the build step that makes
 * it happen.
 *
 * The files an include reads are supplied in memory, so each test says exactly
 * what the build had to read — and a file the deck should not have read fails
 * the test rather than the machine.
 */
import { describe, expect, test } from 'bun:test'
import { compile } from '@mdx-js/mdx'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import { remarkImports } from '../src/build/remark-imports'
import { remarkSlides } from '../src/build/remark-slides'

async function compileDeck(
  files: Record<string, string>,
  entry = '/deck/main.mdx'
): Promise<string> {
  const read = (path: string): string => {
    const source = files[path]
    if (source === undefined) throw new Error(`no such file: ${path}`)
    return source
  }

  const compiled = await compile(
    { value: files[entry] ?? '', path: entry },
    {
      remarkPlugins: [
        remarkFrontmatter,
        remarkMdxFrontmatter,
        [remarkImports, { read }],
        remarkSlides
      ]
    }
  )
  return String(compiled.value)
}

describe('remarkImports (R18)', () => {
  test('an include becomes an import of the file, not a copy of its text', async () => {
    const output = await compileDeck({
      '/deck/main.mdx': '# One\n\n---\n\n<Slides src="./part.mdx" />\n',
      '/deck/part.mdx': '## A\n\n---\n\n## B\n'
    })

    expect(output).toContain('import __saburto_slides_1 from "./part.mdx"')
    expect(output).toContain('src: __saburto_slides_1')
    /* The content of the included file is not in this module. */
    expect(output).not.toContain('## A')
  })

  test('a slide that is an include stands at the deck position it was written', async () => {
    const output = await compileDeck({
      '/deck/main.mdx': '# One\n\n---\n\n<Slides src="./part.mdx" />\n\n---\n\n# Four\n',
      '/deck/part.mdx': '## A\n\n---\n\n## B\n'
    })

    /* One slide before it, and it brings two. */
    expect(output).toContain('offset: "1"')
    expect(output).toContain('index: "3"')
  })

  test('an include inside a slide is content, not slides of its own', async () => {
    const output = await compileDeck({
      '/deck/main.mdx': '# One\n\n---\n\n# Two\n\n<Slides src="./part.mdx" />\n',
      '/deck/part.mdx': '## A\n\n---\n\n## B\n'
    })

    /* The slide around it is the deck's second, and it keeps the include as
       its own content: no offset, no slides of the included file. */
    expect(output).toContain('index: "1"')
    expect(output).toContain('src: __saburto_slides_1')
    expect(output).not.toContain('offset:')
  })

  test('a file included twice is imported once', async () => {
    const output = await compileDeck({
      '/deck/main.mdx':
        '<Slides src="./part.mdx" />\n\n---\n\n# Between\n\n---\n\n<Slides src="./part.mdx" />\n',
      '/deck/part.mdx': '## A\n\n---\n\n## B\n'
    })

    expect(output.match(/import __saburto_slides_1/g)).toHaveLength(1)
    expect(output.match(/src: __saburto_slides_1/g)).toHaveLength(2)
    /* The second include begins after the three slides before it. */
    expect(output).toContain('offset: "3"')
  })

  test('a file may include another file', async () => {
    const files = {
      '/deck/main.mdx': '<Slides src="./part.mdx" />\n',
      '/deck/part.mdx': '## A\n\n---\n\n<Slides src="./deeper.mdx" />\n',
      '/deck/deeper.mdx': '## Deep\n'
    }

    /* Each file imports what it includes, so each file is a dependency of the
       one that includes it, and the bundler watches the whole chain. */
    const output = await compileDeck(files)
    expect(output).toContain('import __saburto_slides_1 from "./part.mdx"')

    const middle = await compileDeck(files, '/deck/part.mdx')
    expect(middle).toContain('import __saburto_slides_1 from "./deeper.mdx"')
  })

  test('an included file that is not there is a build error', async () => {
    await expect(
      compileDeck({ '/deck/main.mdx': '<Slides src="./missing.mdx" />\n' })
    ).rejects.toThrow(/included file not found/)
  })

  test('a file that includes itself is a build error, not a stack overflow', async () => {
    await expect(
      compileDeck({
        '/deck/main.mdx': '<Slides src="./a.mdx" />\n',
        '/deck/a.mdx': '<Slides src="./main.mdx" />\n'
      })
    ).rejects.toThrow(/cannot include itself/)
  })

  test('an include whose src is not a relative path is a build error', async () => {
    await expect(compileDeck({ '/deck/main.mdx': '<Slides src="part.mdx" />\n' })).rejects.toThrow(
      /has to be a relative path/
    )
  })

  test('an include without a file named is a build error', async () => {
    await expect(compileDeck({ '/deck/main.mdx': '<Slides />\n' })).rejects.toThrow(/needs a src/)
  })
})
