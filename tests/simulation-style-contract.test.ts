import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const simulationCss = readFileSync(
  new URL('../src/features/simulation/simulation.css', import.meta.url),
  'utf8',
)

describe('contrato responsivo da experiência clínica', () => {
  it('possui composição lado a lado e breakpoint de empilhamento', () => {
    expect(simulationCss).toContain(
      'grid-template-columns: minmax(220px, 0.7fr) minmax(0, 1.75fr)',
    )
    expect(simulationCss).toContain('@media (max-width: 760px)')
    expect(simulationCss).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.clinical-simulation-view \{[\s\S]*?grid-template-columns: 1fr/,
    )
  })

  it('remove movimento não essencial quando o sistema solicita redução', () => {
    expect(simulationCss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(simulationCss).toContain('animation-duration: 0.01ms !important')
    expect(simulationCss).toContain('transition-duration: 0.01ms !important')
  })
})
