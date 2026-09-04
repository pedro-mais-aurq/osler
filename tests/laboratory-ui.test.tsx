// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SimulationEngine } from '../src/features/simulation/SimulationEngine'
import { ClinicalSimulationView } from '../src/features/simulation/ui/ClinicalSimulationView'
import { LaboratoryArtifactPanel } from '../src/features/simulation/ui/LaboratoryArtifactPanel'
import type {
  CaseStep,
  LaboratoryVisibleData,
  SimulationCase,
} from '../src/features/simulation/types'

const laboratory: LaboratoryVisibleData = {
  stage: 'sample',
  title: 'Conferência da amostra',
  fields: [
    { label: 'Material', value: 'Sangue total' },
    { label: 'Recipiente', value: 'Tubo com EDTA' },
  ],
  notes: ['Informação já disponível ao estudante.'],
}

const baseStep: CaseStep = {
  id: 'laboratory-decision',
  caseId: 'clinical-analysis-case',
  position: 3,
  stepKey: 'preanalytical-decision',
  type: 'decision',
  title: 'Decisão pré-analítica',
  content: {
    body: 'Escolha a próxima ação.',
    observations: [],
    laboratory,
  },
  options: [
    { id: 'preserve-traceability', label: 'Preservar a rastreabilidade' },
  ],
  presentationState: 'warning',
}

const simulationCase: SimulationCase = {
  case: {
    id: 'clinical-analysis-case',
    slug: 'clinical-analysis-fixture',
    title: 'Caso laboratorial de teste',
    description: 'Contexto público.',
    educationalObjective: 'Objetivo público.',
    status: 'published',
  },
  patient: {
    id: 'laboratory-patient',
    displayName: 'Paciente fictícia',
    ageYears: 36,
    sexOrAnatomyContext: 'Pessoa vinculada ao caso.',
    pronouns: 'ela/dela',
    visualRef: null,
  },
  firstStep: baseStep,
}

afterEach(cleanup)

describe('LaboratoryArtifactPanel', () => {
  it('renderiza título, labels e valores visíveis', () => {
    render(<LaboratoryArtifactPanel data={laboratory} />)

    expect(screen.getByRole('heading', { name: laboratory.title })).toBeTruthy()
    expect(screen.getByText('Material')).toBeTruthy()
    expect(screen.getByText('Sangue total')).toBeTruthy()
    expect(screen.getByText('Recipiente')).toBeTruthy()
    expect(screen.getByText('Tubo com EDTA')).toBeTruthy()
    expect(screen.getByText('Informação já disponível ao estudante.')).toBeTruthy()
  })
})

describe('conteúdo laboratorial na prancheta compartilhada', () => {
  it('entra no caso de Análises Clínicas pelo SimulationEngine existente', async () => {
    const user = userEvent.setup()
    render(<SimulationEngine onComplete={vi.fn()} simulationCase={simulationCase} />)

    await user.click(screen.getByRole('button', { name: 'Iniciar caso' }))

    expect(screen.getByRole('tab', { name: 'Amostra' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: baseStep.title! })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Preservar a rastreabilidade' }),
    ).toBeTruthy()
  })

  it('mostra a aba Amostra somente quando o payload existe', () => {
    const { rerender } = render(
      <ClinicalSimulationView
        busy={false}
        errorMessage={null}
        evaluation={null}
        mode="step"
        onContinue={vi.fn()}
        onRetry={vi.fn()}
        onSelectOption={vi.fn()}
        presentationState="warning"
        selectedOptionId={null}
        showContinue={false}
        simulationCase={simulationCase}
        status={null}
        step={baseStep}
        stepNumber={3}
      />,
    )

    expect(screen.getByRole('tab', { name: 'Amostra' })).toBeTruthy()

    rerender(
      <ClinicalSimulationView
        busy={false}
        errorMessage={null}
        evaluation={null}
        mode="step"
        onContinue={vi.fn()}
        onRetry={vi.fn()}
        onSelectOption={vi.fn()}
        presentationState="stable"
        selectedOptionId={null}
        showContinue={false}
        simulationCase={simulationCase}
        status={null}
        step={{
          ...baseStep,
          content: { body: 'Etapa sem laboratório.', observations: [] },
        }}
        stepNumber={4}
      />,
    )

    expect(screen.queryByRole('tab', { name: 'Amostra' })).toBeNull()
  })

  it('mantém a decisão fora das abas e suporta teclado na aba laboratorial', async () => {
    const onSelectOption = vi.fn()
    const user = userEvent.setup()
    render(
      <ClinicalSimulationView
        busy={false}
        errorMessage={null}
        evaluation={null}
        mode="step"
        onContinue={vi.fn()}
        onRetry={vi.fn()}
        onSelectOption={onSelectOption}
        presentationState="warning"
        selectedOptionId={null}
        showContinue={false}
        simulationCase={simulationCase}
        status={null}
        step={baseStep}
        stepNumber={3}
      />,
    )

    const clipboardTab = screen.getByRole('tab', { name: 'Prancheta' })
    const sampleTab = screen.getByRole('tab', { name: 'Amostra' })
    clipboardTab.focus()
    await user.keyboard('{End}')

    expect(sampleTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { name: laboratory.title })).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Preservar a rastreabilidade' }),
    ).toBeTruthy()
    expect(onSelectOption).not.toHaveBeenCalled()
    expect(screen.queryByText('private-rule-marker')).toBeNull()
  })
})
