import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const simulationCss = readFileSync(
  new URL('../src/features/simulation/simulation.css', import.meta.url),
  'utf8',
)
const caseService = readFileSync(
  new URL('../src/services/cases.ts', import.meta.url),
  'utf8',
)

function listSourceFiles(directory: URL): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory)

    return entry.isDirectory()
      ? listSourceFiles(entryUrl)
      : [entry.name]
  })
}

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

  it('não duplica o motor para Análises Clínicas', () => {
    const sourceFiles = listSourceFiles(
      new URL('../src/features/simulation/', import.meta.url),
    )

    expect(sourceFiles).not.toContain('LaboratoryEngine.tsx')
    expect(sourceFiles).not.toContain('ClinicalAnalysisEngine.tsx')
    expect(sourceFiles).not.toContain('LabEngine.tsx')
  })

  it('mantém o carregamento progressivo das etapas', () => {
    expect(caseService).toMatch(
      /\.from\('case_steps'\)[\s\S]*?\.order\('position',[\s\S]*?\.limit\(1\)/,
    )
    expect(caseService).toMatch(
      /getVisibleCaseStepByKey[\s\S]*?\.from\('case_steps'\)[\s\S]*?\.eq\('step_key', stepKey\)/,
    )
    expect(caseService).not.toContain(".from('case_truth_models')")
    expect(caseService).not.toContain(".from('case_step_rules')")
  })
})
