// Package the same integrated React app, including lazy pages, images and fonts.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import path from 'node:path'

let html = await readFile('dist/index.html', 'utf8')
const jsPath = html.match(/<script[^>]*src="([^"]+)"[^>]*><\/script>/)?.[1]
const cssPath = html.match(/<link[^>]*href="([^"]+\.css)"[^>]*>/)?.[1]
assert(jsPath && cssPath, 'Execute npm run build:local antes de empacotar.')
let js = await readFile(path.join('dist', jsPath.replace(/^\//, '')), 'utf8')
let css = await readFile(path.join('dist', cssPath.replace(/^\//, '')), 'utf8')
const mime = { '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2' }

function embedQuotedUrl(source, url, data) {
  return source
    .replaceAll(`"${url}"`, `"${data}"`)
    .replaceAll(`'${url}'`, `'${data}'`)
}

async function embed(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) { await embed(filename); continue }
    const type = mime[path.extname(filename)]
    if (!type) continue
    const url = '/' + path.relative('dist', filename).split(path.sep).join('/')
    if (!js.includes(url) && !css.includes(url) && !html.includes(url)) continue
    const data = `data:${type};base64,${(await readFile(filename)).toString('base64')}`
    // Match whole URLs so a path like ../../public/images/photo.webp stays intact.
    js = embedQuotedUrl(js, url, data)
    css = embedQuotedUrl(css, url, data).replaceAll(`url(${url})`, `url(${data})`)
    html = embedQuotedUrl(html, url, data)
  }
}
await embed('dist')
assert(!/import\s*\(["'][./]/.test(js), 'O build local deve incluir todas as páginas em um único bundle.')
html = html
  .replace(/<script[^>]*src="[^"]+"[^>]*><\/script>/, () => `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`)
  .replace(/<link[^>]*href="[^"]+\.css"[^>]*>/, () => `<style>${css}</style>`)
  .replace('<title>Aprender a cuidar · Osler</title>', '<title>Osler · Plataforma integrada local</title>')
assert(!/<(?:script|link)[^>]+(?:src|href)="(?:\/|https?:)/.test(html), 'O HTML local não deve carregar scripts ou estilos externos.')
await mkdir('preview-local', { recursive: true })
await writeFile('preview-local/Osler_Demonstracao_Local.html', html)
console.log(`Demonstração integrada autossuficiente criada (${(Buffer.byteLength(html) / 1048576).toFixed(1)} MB).`)
