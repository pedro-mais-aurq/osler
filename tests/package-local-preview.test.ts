import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const packager = fileURLToPath(new URL('../scripts/package-local-preview.mjs', import.meta.url))

it('incorpora URLs de imagens sem alterar as chaves usadas para encontrá-las', async () => {
  const project = await mkdtemp(join(tmpdir(), 'osler-preview-'))
  const dist = join(project, 'dist')
  const image = Buffer.from('imagem de teste')
  const font = Buffer.from('fonte de teste')
  const icon = '<svg xmlns="http://www.w3.org/2000/svg"/>'
  const sourceKey = '../../public/images/osler-educacao.webp'
  try {
    for (const directory of ['assets', 'images', 'fonts']) {
      await mkdir(join(dist, directory), { recursive: true })
    }
    await writeFile(join(dist, 'images', 'osler-educacao.webp'), image)
    await writeFile(join(dist, 'assets', 'osler-educacao-hash.webp'), image)
    await writeFile(join(dist, 'fonts', 'NimbusSans-Regular.woff'), font)
    await writeFile(join(dist, 'favicon.svg'), icon)
    await writeFile(join(dist, 'assets', 'index.js'),
      `const images = {"${sourceKey}":"/assets/osler-educacao-hash.webp"}`)
    await writeFile(join(dist, 'assets', 'index.css'),
      "@font-face{src:url(/fonts/NimbusSans-Regular.woff)}.photo{background:url('/images/osler-educacao.webp')}")
    await writeFile(join(dist, 'index.html'), [
      '<link rel="icon" href="/favicon.svg">',
      '<link rel="stylesheet" href="/assets/index.css">',
      '<script type="module" src="/assets/index.js"></script>',
    ].join('\n'))

    execFileSync(process.execPath, [packager], { cwd: project })
    const html = await readFile(join(project, 'preview-local', 'Osler_Demonstracao_Local.html'), 'utf8')
    const imageData = `data:image/webp;base64,${image.toString('base64')}`
    expect(html).toContain(`"${sourceKey}":"${imageData}"`)
    expect(html).toContain(`url('${imageData}')`)
    expect(html).toContain(`url(data:font/woff;base64,${font.toString('base64')})`)
    expect(html).toContain(`href="data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}"`)
  } finally {
    await rm(project, { recursive: true, force: true })
  }
})
