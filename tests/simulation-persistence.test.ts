import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  parseAdvanceSimulationResult,
  parseRecordedSimulationDecision,
  parseSimulationSessionSnapshot,
} from '../src/features/simulation/persistenceParsers'

const supabaseMocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../src/lib/supabase', () => ({
  supabase: { rpc: supabaseMocks.rpc },
  supabaseConfigurationError: null,
}))

const startRow = {
  session_id: 'session-a',
  case_id: 'case-a',
  status: 'in_progress',
  current_step_id: 'step-a',
  current_step_key: 'information-a',
  score_total: 0,
  decision_count: 0,
  started_at: '2026-09-04T20:00:00.000Z',
  resumed: false,
  selected_option_id: null,
  classification: null,
  score_delta: null,
  feedback: null,
  consequence: null,
  next_step_key: null,
  transition_completed: null,
  presentation_state: 'stable',
}

const resumedRow = {
  ...startRow,
  current_step_id: 'step-b',
  current_step_key: 'decision-b',
  score_total: 2,
  decision_count: 1,
  resumed: true,
  selected_option_id: 'option-a',
  classification: 'acceptable',
  score_delta: 2,
  feedback: 'Persisted selected feedback.',
  consequence: 'Persisted selected consequence.',
  next_step_key: 'step-c',
  transition_completed: false,
  presentation_state: 'warning',
}

const decisionRow = {
  action_id: 'action-a',
  session_id: 'session-a',
  step_id: 'step-b',
  selected_option_id: 'option-a',
  classification: 'ideal',
  score_delta: 2,
  feedback: 'Selected feedback.',
  consequence: null,
  next_step_key: 'step-c',
  completed: false,
  presentation_state: 'recovery',
  score_total: 5,
  decision_count: 2,
  created_at: '2026-09-04T20:01:00.000Z',
  replayed: false,
}

const advanceRow = {
  session_id: 'session-a',
  status: 'in_progress',
  current_step_id: 'step-c',
  current_step_key: 'step-c',
  score_total: 5,
  decision_count: 2,
  completed_at: null,
  previous_step_id: 'step-b',
  presentation_state: 'recovery',
  replayed: false,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('parsers de persistência', () => {
  it('normaliza uma nova sessão sem decisão', () => {
    expect(parseSimulationSessionSnapshot([startRow])).toEqual({
      sessionId: 'session-a',
      caseId: 'case-a',
      status: 'in_progress',
      currentStepId: 'step-a',
      currentStepKey: 'information-a',
      scoreTotal: 0,
      decisionCount: 0,
      startedAt: '2026-09-04T20:00:00.000Z',
      resumed: false,
      presentationState: 'stable',
      recordedDecision: null,
    })
  })

  it('normaliza retomada com apenas a avaliação escolhida', () => {
    const parsed = parseSimulationSessionSnapshot([resumedRow])

    expect(parsed?.recordedDecision).toEqual({
      selectedOptionId: 'option-a',
      transition: {
        evaluation: {
          classification: 'acceptable',
          scoreDelta: 2,
          feedback: 'Persisted selected feedback.',
          consequence: 'Persisted selected consequence.',
        },
        nextStepKey: 'step-c',
        completed: false,
        presentationState: 'warning',
      },
    })
  })

  it.each([
    ['status inválido', { status: 'forged' }],
    ['score fracionário', { score_total: 1.5 }],
    ['contagem negativa', { decision_count: -1 }],
    ['step ausente', { current_step_id: null }],
    ['estado visual inválido', { presentation_state: 'unsafe' }],
    ['ação parcial', { selected_option_id: 'option-a' }],
    ['dado privado inesperado', { truth: 'must-not-arrive' }],
  ])('rejeita snapshot de sessão com %s', (_label, change) => {
    expect(parseSimulationSessionSnapshot([{ ...startRow, ...change }])).toBeNull()
  })

  it('normaliza decisão registrada e totais server-side', () => {
    expect(parseRecordedSimulationDecision([decisionRow])).toMatchObject({
      actionId: 'action-a',
      sessionId: 'session-a',
      stepId: 'step-b',
      selectedOptionId: 'option-a',
      scoreTotal: 5,
      decisionCount: 2,
      replayed: false,
      transition: {
        evaluation: {
          classification: 'ideal',
          scoreDelta: 2,
          feedback: 'Selected feedback.',
        },
      },
    })
  })

  it.each([
    ['classificação inválida', { classification: 'correct' }],
    ['delta inválido', { score_delta: '2' }],
    ['feedback vazio', { feedback: '' }],
    ['destino ausente', { next_step_key: null }],
    ['estado visual inválido', { presentation_state: 'danger' }],
    ['campo de regra inesperado', { expected_answer: 'option-a' }],
  ])('rejeita decisão registrada com %s', (_label, change) => {
    expect(parseRecordedSimulationDecision([{ ...decisionRow, ...change }])).toBeNull()
  })

  it('aceita decisão terminal sem próxima etapa', () => {
    const parsed = parseRecordedSimulationDecision([
      { ...decisionRow, completed: true, next_step_key: null },
    ])

    expect(parsed?.transition.completed).toBe(true)
    expect(parsed?.transition.nextStepKey).toBeNull()
  })

  it('normaliza avanço em andamento e conclusão persistida', () => {
    expect(parseAdvanceSimulationResult([advanceRow])).toMatchObject({
      status: 'in_progress',
      currentStepId: 'step-c',
      scoreTotal: 5,
      replayed: false,
    })

    expect(
      parseAdvanceSimulationResult([
        {
          ...advanceRow,
          status: 'completed',
          completed_at: '2026-09-04T20:02:00.000Z',
          presentation_state: null,
        },
      ]),
    ).toMatchObject({
      status: 'completed',
      completedAt: '2026-09-04T20:02:00.000Z',
    })
  })

  it.each([
    ['completed sem timestamp', { status: 'completed' }],
    ['in progress com timestamp', { completed_at: '2026-09-04T20:02:00.000Z' }],
    ['status abandonado', { status: 'abandoned' }],
    ['contagem inválida', { decision_count: 1.5 }],
    ['target inválido', { current_step_key: '' }],
    ['campo privado inesperado', { case_truth_models: {} }],
  ])('rejeita avanço com %s', (_label, change) => {
    expect(parseAdvanceSimulationResult([{ ...advanceRow, ...change }])).toBeNull()
  })
})

describe('serviço de persistência', () => {
  it('inicia ou retoma enviando somente caseId', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: [startRow], error: null })
    const { startOrResumeSimulationSession } = await import(
      '../src/services/simulationPersistence'
    )

    const result = await startOrResumeSimulationSession('case-a')

    expect(supabaseMocks.rpc).toHaveBeenCalledWith(
      'start_or_resume_simulation_session',
      { p_case_id: 'case-a' },
    )
    expect(result.ok && result.session.sessionId).toBe('session-a')
  })

  it('registra decisão sem enviar score, outcome, userId ou caseId', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: [decisionRow], error: null })
    const { recordSimulationDecision } = await import(
      '../src/services/simulationPersistence'
    )

    const result = await recordSimulationDecision(
      'session-a',
      'step-b',
      'option-a',
    )

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('record_simulation_decision', {
      p_session_id: 'session-a',
      p_step_id: 'step-b',
      p_option_id: 'option-a',
    })
    expect(result.ok && result.decision.scoreTotal).toBe(5)
  })

  it('avança sem aceitar target, status ou completedAt do cliente', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: [advanceRow], error: null })
    const { advanceSimulationSession } = await import(
      '../src/services/simulationPersistence'
    )

    const result = await advanceSimulationSession('session-a', 'step-b')

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('advance_simulation_session', {
      p_session_id: 'session-a',
      p_step_id: 'step-b',
    })
    expect(result.ok && result.result.currentStepKey).toBe('step-c')
  })

  it('rejeita resposta com IDs diferentes da requisição', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [{ ...decisionRow, session_id: 'other-session' }],
      error: null,
    })
    const { recordSimulationDecision } = await import(
      '../src/services/simulationPersistence'
    )

    const result = await recordSimulationDecision(
      'session-a',
      'step-b',
      'option-a',
    )

    expect(result.ok).toBe(false)
  })

  it('preserva erro de rede como falha recuperável', async () => {
    const networkError = new Error('network')
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: networkError })
    const { advanceSimulationSession } = await import(
      '../src/services/simulationPersistence'
    )

    const result = await advanceSimulationSession('session-a', 'step-b')

    expect(result).toEqual({
      ok: false,
      message: 'Não foi possível avançar esta etapa. Tente novamente.',
      cause: networkError,
    })
  })
})
