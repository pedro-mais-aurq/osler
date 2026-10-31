import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const debriefCss = readFileSync(
  new URL('../src/features/debrief/debrief.css', import.meta.url),
  'utf8',
)

describe('contrato responsivo do debrief', () => {
  it('limita a folha para projetor e empilha a composição no mobile', () => {
    expect(debriefCss).toContain('width: min(100%, 1120px)')
    expect(debriefCss).toContain('@media (max-width: 760px)')
    expect(debriefCss).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.debrief-category-grid,[\s\S]*?grid-template-columns: 1fr/,
    )
    expect(debriefCss).toContain('@media (max-width: 420px)')
  })

  it('remove transições não essenciais com preferência de movimento reduzido', () => {
    expect(debriefCss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(debriefCss).toContain('transition-duration: 0.01ms !important')
  })
})
