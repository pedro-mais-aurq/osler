// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClinicalSimulationView } from '../src/features/simulation/ui/ClinicalSimulationView'
import {
  PatientPanel,
  resolvePatientVisualRef,
} from '../src/features/simulation/ui/PatientPanel'
import { PresentationStateBadge } from '../src/features/simulation/ui/PresentationStateBadge'
import { WorkspaceTabs } from '../src/features/simulation/ui/WorkspaceTabs'
import type {
  CaseStep,
  ClinicalPresentationState,
  SimulationCase,
  SimulationPatient,
} from '../src/features/simulation/types'

const patient: SimulationPatient = {
  id: 'patient-fixture',
  displayName: 'Alex de Souza',
  ageYears: 42,
  sexOrAnatomyContext: 'Pessoa adulta, sentada e consciente.',
  pronouns: 'ela/dela',
  visualRef: 'patients/patient-fixture.svg',
}

const decisionStep: CaseStep = {
  id: 'decision-fixture',
  caseId: 'case-fixture',
  position: 1,
  stepKey: 'decision',
  type: 'decision',
  title: 'Defina a próxima ação',
  content: {
    body: 'Escolha uma conduta a partir dos dados já apresentados.',
    observations: ['Observação autorizada.'],
  },
  options: [
    { id: 'option-a', label: 'Ação clínica A' },
    { id: 'option-b', label: 'Ação clínica B' },
  ],
  presentationState: 'stable',
}

const simulationCase: SimulationCase = {
  case: {
    id: 'case-fixture',
    slug: 'case-fixture',
    title: 'Caso educacional de teste',
    description: 'Contexto público do caso.',
    educationalObjective: 'Objetivo público do caso.',
    status: 'published',
  },
  patient,
  firstStep: decisionStep,
}

afterEach(cleanup)

describe('PatientPanel', () => {
  it('renderiza somente os dados permitidos do paciente e mantém a arte decorativa', () => {
    render(<PatientPanel patient={patient} presentationState="stable" />)

    expect(screen.getByRole('complementary', { name: 'Paciente do caso' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: patient.displayName })).toBeTruthy()
    expect(screen.getByText('42 anos')).toBeTruthy()
    expect(screen.getByText(patient.sexOrAnatomyContext!)).toBeTruthy()
    expect(screen.getByText(patient.pronouns!)).toBeTruthy()
    expect(screen.getByTestId('patient-visual').getAttribute('alt')).toBe('')
  })

  it('resolve visualRef com BASE_URL e usa a ilustração neutra como fallback', () => {
    expect(resolvePatientVisualRef('patients/patient-fixture.svg')).toBe(
      `${import.meta.env.BASE_URL}patients/patient-fixture.svg`,
    )
    expect(resolvePatientVisualRef(null)).toBe(
      `${import.meta.env.BASE_URL}patients/patient-neutral.svg`,
    )
    expect(resolvePatientVisualRef('../private.svg')).toBe(
      `${import.meta.env.BASE_URL}patients/patient-neutral.svg`,
    )
  })

  it('troca para o fallback se o visualRef não carregar', () => {
    render(<PatientPanel patient={patient} presentationState="stable" />)
    const image = screen.getByTestId('patient-visual') as HTMLImageElement

    fireEvent.error(image)

    expect(image.src).toContain('/patients/patient-neutral.svg')
  })
})

describe('WorkspaceTabs', () => {
  it('expõe seleção semântica e troca o painel sem callback clínico', async () => {
    const user = userEvent.setup()
    const clinicalCallback = vi.fn()
    render(
      <>
        <WorkspaceTabs
          label="Área clínica"
          tabs={[
            { id: 'clipboard', label: 'Prancheta', content: 'Painel da prancheta' },
            { id: 'patient', label: 'Paciente', content: 'Painel do paciente' },
          ]}
        />
        <button onClick={clinicalCallback} type="button">
          Ação clínica
        </button>
      </>,
    )

    const clipboardTab = screen.getByRole('tab', { name: 'Prancheta' })
    const patientTab = screen.getByRole('tab', { name: 'Paciente' })
    expect(clipboardTab.getAttribute('aria-selected')).toBe('true')
    expect(patientTab.getAttribute('aria-selected')).toBe('false')
    expect(document.getElementById(clipboardTab.getAttribute('aria-controls')!)).toBeTruthy()
    expect(document.getElementById(patientTab.getAttribute('aria-controls')!)).toBeTruthy()

    await user.click(patientTab)

    expect(patientTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Painel do paciente')).toBeTruthy()
    expect(clinicalCallback).not.toHaveBeenCalled()
  })

  it('suporta ArrowLeft, ArrowRight, Home e End', async () => {
    const user = userEvent.setup()
    render(
      <WorkspaceTabs
        label="Área clínica"
        tabs={[
          { id: 'clipboard', label: 'Prancheta', content: 'Um' },
          { id: 'patient', label: 'Paciente', content: 'Dois' },
          { id: 'context', label: 'Contexto', content: 'Três' },
        ]}
      />,
    )

    const clipboardTab = screen.getByRole('tab', { name: 'Prancheta' })
    const patientTab = screen.getByRole('tab', { name: 'Paciente' })
    const contextTab = screen.getByRole('tab', { name: 'Contexto' })
    clipboardTab.focus()

    await user.keyboard('{ArrowRight}')
    expect(patientTab.getAttribute('aria-selected')).toBe('true')
    await user.keyboard('{End}')
    expect(contextTab.getAttribute('aria-selected')).toBe('true')
    await user.keyboard('{Home}')
    expect(clipboardTab.getAttribute('aria-selected')).toBe('true')
    await user.keyboard('{ArrowLeft}')
    expect(contextTab.getAttribute('aria-selected')).toBe('true')
  })
})

describe('PresentationStateBadge', () => {
  it.each<[ClinicalPresentationState, string]>([
    ['stable', 'Estado: Estável'],
    ['warning', 'Estado: Atenção'],
    ['critical', 'Estado: Crítico'],
    ['recovery', 'Estado: Recuperação'],
  ])('mostra texto próprio para %s', (state, label) => {
    render(<PresentationStateBadge state={state} />)

    const badge = screen.getByRole('status')
    expect(badge.textContent).toContain(label)
    expect(badge.getAttribute('data-presentation-state')).toBe(state)
  })
})

describe('ClinicalSimulationView', () => {
  it('usa linguagem de início válida para os dois cursos', () => {
    render(
      <ClinicalSimulationView
        busy={false}
        errorMessage={null}
        mode="intro"
        onRetry={vi.fn()}
        onStart={vi.fn()}
        presentationState="stable"
        simulationCase={simulationCase}
      />,
    )

    expect(screen.getByText(/inicie a simulação/i)).toBeTruthy()
    expect(screen.getByText('Pessoa vinculada ao caso')).toBeTruthy()
    expect(screen.queryByText(/inicie o atendimento/i)).toBeNull()
  })

  it('mantém a decisão clicável e visível ao trocar a aba visual', async () => {
    const user = userEvent.setup()
    const onSelectOption = vi.fn()
    const onContinue = vi.fn()
    render(
      <ClinicalSimulationView
        busy={false}
        errorMessage={null}
        evaluation={null}
        mode="step"
        onContinue={onContinue}
        onRetry={vi.fn()}
        onSelectOption={onSelectOption}
        presentationState="warning"
        selectedOptionId={null}
        showContinue={false}
        simulationCase={simulationCase}
        status={null}
        step={decisionStep}
        stepNumber={1}
      />,
    )

    expect(screen.getByRole('heading', { name: simulationCase.case.title })).toBeTruthy()
    expect(screen.getByText('Estado: Atenção')).toBeTruthy()
    await user.click(screen.getByRole('tab', { name: 'Paciente' }))
    expect(screen.getByRole('button', { name: 'Ação clínica A' })).toBeTruthy()
    expect(onSelectOption).not.toHaveBeenCalled()
    expect(onContinue).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Ação clínica B' }))
    expect(onSelectOption).toHaveBeenCalledWith('option-b')
  })

  it('mantém feedback do servidor e ação Continuar acessíveis', () => {
    render(
      <ClinicalSimulationView
        busy={false}
        errorMessage={null}
        evaluation={{
          classification: 'acceptable',
          scoreDelta: -20,
          feedback: 'Feedback retornado pelo servidor.',
          consequence: 'Consequência retornada pelo servidor.',
        }}
        mode="step"
        onContinue={vi.fn()}
        onRetry={vi.fn()}
        onSelectOption={vi.fn()}
        presentationState="recovery"
        selectedOptionId="option-a"
        showContinue
        simulationCase={simulationCase}
        status={null}
        step={decisionStep}
        stepNumber={2}
      />,
    )

    expect(screen.getByText('Estado: Recuperação')).toBeTruthy()
    expect(screen.getByText('Feedback retornado pelo servidor.')).toBeTruthy()
    expect(screen.getByText('Consequência retornada pelo servidor.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeTruthy()
  })
})
