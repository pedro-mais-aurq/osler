// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SimulationEngine } from '../src/features/simulation/SimulationEngine'
import type {
  CaseStep,
  SimulationCase,
  SimulationSessionSnapshot,
} from '../src/features/simulation/types'

const serviceMocks = vi.hoisted(() => ({
  advanceSimulationSession: vi.fn(),
  getVisibleCaseStepByKey: vi.fn(),
  recordSimulationDecision: vi.fn(),
  startOrResumeSimulationSession: vi.fn(),
}))

vi.mock('../src/services/cases', () => ({
  getVisibleCaseStepByKey: serviceMocks.getVisibleCaseStepByKey,
}))

vi.mock('../src/services/simulationPersistence', () => ({
  advanceSimulationSession: serviceMocks.advanceSimulationSession,
  recordSimulationDecision: serviceMocks.recordSimulationDecision,
  startOrResumeSimulationSession: serviceMocks.startOrResumeSimulationSession,
}))

const caseId = 'case-persistence'
const sessionId = 'session-persistence'

const informationStep: CaseStep = {
  id: 'step-information',
  caseId,
  position: 1,
  stepKey: 'information',
  type: 'information',
  title: 'Informação inicial persistente',
  content: { body: 'Conteúdo inicial.', observations: [] },
  presentationState: 'stable',
}

const decisionStep: CaseStep = {
  id: 'step-decision',
  caseId,
  position: 2,
  stepKey: 'decision',
  type: 'decision',
  title: 'Decisão persistente',
  content: { body: 'Escolha uma ação.', observations: [] },
  options: [
    { id: 'option-a', label: 'Opção persistida A' },
    { id: 'option-b', label: 'Opção persistida B' },
  ],
  presentationState: 'warning',
}

const finalStep: CaseStep = {
  id: 'step-final',
  caseId,
  position: 3,
  stepKey: 'final',
  type: 'information',
  title: 'Etapa final persistente',
  content: { body: 'Encerramento.', observations: [] },
  presentationState: 'recovery',
}

const simulationCase: SimulationCase = {
  case: {
    id: caseId,
    slug: 'persistent-fixture',
    title: 'Caso persistente de teste',
    description: 'Fixture pública.',
    educationalObjective: null,
    status: 'published',
  },
  patient: {
    id: 'patient-persistence',
    displayName: 'Paciente Persistência',
    ageYears: null,
    sexOrAnatomyContext: null,
    pronouns: null,
    visualRef: null,
  },
  firstStep: informationStep,
}

function sessionSnapshot(
  step: CaseStep = informationStep,
  overrides: Partial<SimulationSessionSnapshot> = {},
): SimulationSessionSnapshot {
  return {
    sessionId,
    caseId,
    status: 'in_progress',
    currentStepId: step.id,
    currentStepKey: step.stepKey,
    scoreTotal: 0,
    decisionCount: 0,
    startedAt: '2026-09-04T20:00:00.000Z',
    resumed: false,
    presentationState: step.presentationState,
    recordedDecision: null,
    ...overrides,
  }
}

function recordedDecisionResult() {
  return {
    actionId: 'action-persistence',
    sessionId,
    stepId: decisionStep.id,
    selectedOptionId: 'option-a',
    transition: {
      evaluation: {
        classification: 'acceptable' as const,
        scoreDelta: 2,
        feedback: 'Feedback persistido da opção A.',
        consequence: 'Consequência persistida da opção A.',
      },
      nextStepKey: finalStep.stepKey,
      completed: false,
      presentationState: 'recovery' as const,
    },
    scoreTotal: 7,
    decisionCount: 3,
    createdAt: '2026-09-04T20:01:00.000Z',
    replayed: false,
  }
}

function advanceResult(from: CaseStep, to: CaseStep = finalStep) {
  return {
    sessionId,
    status: 'in_progress' as const,
    currentStepId: to.id,
    currentStepKey: to.stepKey,
    scoreTotal: from === informationStep ? 0 : 7,
    decisionCount: from === informationStep ? 0 : 3,
    completedAt: null,
    previousStepId: from.id,
    presentationState: to.presentationState,
    replayed: false,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  serviceMocks.startOrResumeSimulationSession.mockResolvedValue({
    ok: true,
    session: sessionSnapshot(),
  })
  serviceMocks.getVisibleCaseStepByKey.mockImplementation(
    async (_caseId: string, stepKey: string) => ({
      ok: true,
      step: [informationStep, decisionStep, finalStep].find(
        (step) => step.stepKey === stepKey,
      ),
    }),
  )
  serviceMocks.recordSimulationDecision.mockResolvedValue({
    ok: true,
    decision: recordedDecisionResult(),
  })
  serviceMocks.advanceSimulationSession.mockImplementation(
    async (_sessionId: string, stepId: string) => {
      if (stepId === informationStep.id) {
        return { ok: true, result: advanceResult(informationStep, decisionStep) }
      }

      if (stepId === decisionStep.id) {
        return { ok: true, result: advanceResult(decisionStep, finalStep) }
      }

      return {
        ok: true,
        result: {
          ...advanceResult(finalStep),
          status: 'completed',
          currentStepId: finalStep.id,
          currentStepKey: finalStep.stepKey,
          scoreTotal: 7,
          decisionCount: 3,
          completedAt: '2026-09-04T20:02:00.000Z',
          presentationState: null,
        },
      }
    },
  )
})

afterEach(cleanup)

describe('SimulationEngine com persistência P8', () => {
  it('mantém o caso na intro e permite retry quando o start falha', async () => {
    const user = userEvent.setup()
    serviceMocks.startOrResumeSimulationSession
      .mockResolvedValueOnce({
        ok: false,
        message: 'Não foi possível iniciar ou retomar a simulação. Tente novamente.',
        cause: new Error('network'),
      })
      .mockResolvedValueOnce({ ok: true, session: sessionSnapshot() })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(<SimulationEngine onComplete={vi.fn()} simulationCase={simulationCase} />)
    await user.click(screen.getByRole('button', { name: 'Iniciar caso' }))

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Não foi possível iniciar ou retomar a simulação. Tente novamente.',
    )
    expect(screen.getByRole('heading', { name: simulationCase.case.title })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(
      await screen.findByRole('heading', { name: informationStep.title! }),
    ).toBeTruthy()
    expect(serviceMocks.startOrResumeSimulationSession).toHaveBeenCalledTimes(2)
    consoleError.mockRestore()
  })

  it('retoma score e etapa atual sem carregar etapas futuras', async () => {
    const user = userEvent.setup()
    serviceMocks.startOrResumeSimulationSession.mockResolvedValue({
      ok: true,
      session: sessionSnapshot(decisionStep, {
        scoreTotal: 5,
        decisionCount: 2,
        resumed: true,
      }),
    })

    render(<SimulationEngine onComplete={vi.fn()} simulationCase={simulationCase} />)
    await user.click(screen.getByRole('button', { name: 'Iniciar caso' }))

    expect(
      await screen.findByRole('heading', { name: decisionStep.title! }),
    ).toBeTruthy()
    expect(serviceMocks.getVisibleCaseStepByKey).toHaveBeenCalledTimes(1)
    expect(serviceMocks.getVisibleCaseStepByKey).toHaveBeenCalledWith(
      caseId,
      decisionStep.stepKey,
    )
  })

  it('restaura feedback após refresh e avança sem gravar nova action', async () => {
    const user = userEvent.setup()
    const decision = recordedDecisionResult()
    serviceMocks.startOrResumeSimulationSession.mockResolvedValue({
      ok: true,
      session: sessionSnapshot(decisionStep, {
        scoreTotal: decision.scoreTotal,
        decisionCount: decision.decisionCount,
        resumed: true,
        recordedDecision: {
          selectedOptionId: decision.selectedOptionId,
          transition: decision.transition,
        },
      }),
    })

    const firstMount = render(
      <SimulationEngine onComplete={vi.fn()} simulationCase={simulationCase} />,
    )
    await user.click(screen.getByRole('button', { name: 'Iniciar caso' }))
    expect(await screen.findByText('Feedback persistido da opção A.')).toBeTruthy()

    firstMount.unmount()
    render(<SimulationEngine onComplete={vi.fn()} simulationCase={simulationCase} />)
    await user.click(screen.getByRole('button', { name: 'Iniciar caso' }))
    expect(await screen.findByText('Feedback persistido da opção A.')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(
      await screen.findByRole('heading', { name: finalStep.title! }),
    ).toBeTruthy()
    expect(serviceMocks.recordSimulationDecision).not.toHaveBeenCalled()
    expect(serviceMocks.advanceSimulationSession).toHaveBeenCalledWith(
      sessionId,
      decisionStep.id,
    )
  })

  it('preserva a opção e repete a mesma decisão após erro de rede', async () => {
    const user = userEvent.setup()
    serviceMocks.recordSimulationDecision
      .mockResolvedValueOnce({
        ok: false,
        message: 'Não foi possível registrar sua escolha. Tente novamente.',
        cause: new Error('network'),
      })
      .mockResolvedValueOnce({ ok: true, decision: recordedDecisionResult() })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(<SimulationEngine onComplete={vi.fn()} simulationCase={simulationCase} />)
    await user.click(screen.getByRole('button', { name: 'Iniciar caso' }))
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(
      await screen.findByRole('button', { name: 'Opção persistida A' }),
    )

    expect(await screen.findByText('Opção escolhida')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByText('Feedback persistido da opção A.')).toBeTruthy()
    expect(serviceMocks.recordSimulationDecision).toHaveBeenNthCalledWith(
      1,
      sessionId,
      decisionStep.id,
      'option-a',
    )
    expect(serviceMocks.recordSimulationDecision).toHaveBeenNthCalledWith(
      2,
      sessionId,
      decisionStep.id,
      'option-a',
    )
    consoleError.mockRestore()
  })

  it('deduplica double click de decisão enquanto a RPC está em andamento', async () => {
    const user = userEvent.setup()
    let resolveDecision!: (value: unknown) => void
    const pendingDecision = new Promise((resolve) => {
      resolveDecision = resolve
    })
    serviceMocks.recordSimulationDecision.mockReturnValue(pendingDecision)

    render(<SimulationEngine onComplete={vi.fn()} simulationCase={simulationCase} />)
    await user.click(screen.getByRole('button', { name: 'Iniciar caso' }))
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    const option = await screen.findByRole('button', {
      name: 'Opção persistida A',
    })

    fireEvent.click(option)
    fireEvent.click(option)

    expect(serviceMocks.recordSimulationDecision).toHaveBeenCalledTimes(1)

    resolveDecision({ ok: true, decision: recordedDecisionResult() })
    expect(await screen.findByText('Feedback persistido da opção A.')).toBeTruthy()
  })

  it('conclui somente com score e contagem persistidos e inclui sessionId', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    serviceMocks.startOrResumeSimulationSession.mockResolvedValue({
      ok: true,
      session: sessionSnapshot(finalStep, {
        scoreTotal: 7,
        decisionCount: 3,
        resumed: true,
      }),
    })

    render(<SimulationEngine onComplete={onComplete} simulationCase={simulationCase} />)
    await user.click(screen.getByRole('button', { name: 'Iniciar caso' }))
    await user.click(
      await screen.findByRole('button', { name: 'Continuar' }),
    )

    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith({
        sessionId,
        caseId,
        caseTitle: simulationCase.case.title,
        score: 7,
        decisionCount: 3,
      }),
    )
  })
})
