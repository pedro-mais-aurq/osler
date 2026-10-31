// Resolve public imagery at build time so the standalone demo can embed it too.
const images = import.meta.glob<string>('../../public/images/**/*.{webp,png}', {
  eager: true,
  query: '?url',
  import: 'default',
})

export function publicImage(path: string): string {
  const url = images[`../../public/images/${path}`]
  if (!url) throw new Error(`Imagem Osler não encontrada: ${path}`)
  return url
}
