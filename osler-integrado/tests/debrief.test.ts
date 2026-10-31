import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isValidDebriefSessionId,
  parseSimulationDebrief,
} from '../src/features/debrief/parsers'
import {
  createDebriefSummary,
  isWellConducted,
} from '../src/features/debrief/summary'

const supabaseMocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../src/lib/supabase', () => ({
  supabase: { rpc: supabaseMocks.rpc },
  supabaseConfigurationError: null,
}))

const sessionId = '91000000-0000-4000-8000-000000000001'
const caseId = '92000000-0000-4000-8000-000000000001'

const rawDebrief = {
  schema_version: 1,
  session: {
    id: sessionId,
    status: 'completed',
    score_total: -1,
    decision_count: 4,
    started_at: '2026-09-05T10:00:00.000Z',
    completed_at: '2026-09-05T10:08:00.000Z',
  },
  case: {
    id: caseId,
    title: 'Caso histórico de teste',
    educational_objective: 'Revisar decisões efetivamente registradas.',
  },
  decisions: [
    {
      action_id: '93000000-0000-4000-8000-000000000001',
      step_id: '94000000-0000-4000-8000-000000000001',
      step_key: 'decision-one',
      step_title: 'Primeira decisão',
      position: 2,
      selected_option_id: 'option-one',
      selected_option_label: 'Conduta muito adequada',
      classification: 'ideal',
      score_delta: 2,
      feedback: 'Feedback histórico um.',
      consequence: null,
      created_at: '2026-09-05T10:02:00.000Z',
    },
    {
      action_id: '93000000-0000-4000-8000-000000000002',
      step_id: '94000000-0000-4000-8000-000000000002',
      step_key: 'decision-two',
      step_title: 'Segunda decisão',
      position: 3,
      selected_option_id: 'option-two',
      selected_option_label: 'Conduta adequada',
      classification: 'acceptable',
      score_delta: 1,
      feedback: 'Feedback histórico dois.',
      consequence: 'Consequência histórica dois.',
      created_at: '2026-09-05T10:03:00.000Z',
    },
    {
      action_id: '93000000-0000-4000-8000-000000000003',
      step_id: '94000000-0000-4000-8000-000000000003',
      step_key: 'decision-three',
      step_title: null,
      position: 4,
      selected_option_id: 'option-three',
      selected_option_label: 'Conduta a revisar',
      classification: 'needs_improvement',
      score_delta: 0,
      feedback: 'Feedback histórico três.',
      consequence: null,
      created_at: '2026-09-05T10:04:00.000Z',
    },
    {
      action_id: '93000000-0000-4000-8000-000000000004',
      step_id: '94000000-0000-4000-8000-000000000004',
      step_key: 'decision-four',
      step_title: 'Quarta decisão',
      position: 5,
      selected_option_id: 'option-four',
      selected_option_label: 'Conduta insegura',
      classification: 'unsafe',
      score_delta: -4,
      feedback: 'Feedback histórico quatro.',
      consequence: 'Consequência histórica quatro.',
      created_at: '2026-09-05T10:05:00.000Z',
    },
  ],
  references: [
    {
      id: 'source-one',
      authority: 'Autoridade pública de teste',
      title: 'Referência pública sanitizada',
      year: 2026,
      url: 'https://example.org/reference',
      verified_on: '2026-09-05',
    },
    {
      id: 'source-two',
      authority: 'Sociedade científica de teste',
      title: 'Referência sem metadados opcionais',
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('parser do debrief', () => {
  it('normaliza o contrato público e deriva as quatro contagens', () => {
    const parsed = parseSimulationDebrief(rawDebrief)

    expect(parsed).toMatchObject({
      sessionId,
      caseId,
      caseTitle: 'Caso histórico de teste',
      summary: {
        scoreTotal: -1,
        decisionCount: 4,
        classifications: {
          ideal: 1,
          acceptable: 1,
          needsImprovement: 1,
          unsafe: 1,
        },
      },
    })
    expect(parsed?.decisions[1]).toMatchObject({
      selectedOptionLabel: 'Conduta adequada',
      feedback: 'Feedback histórico dois.',
      consequence: 'Consequência histórica dois.',
    })
    expect(parsed?.references[1]).toMatchObject({
      year: null,
      url: null,
      verifiedOn: null,
    })
  })

  it('aceita tentativa concluída com zero decisões e pontuação zero', () => {
    const parsed = parseSimulationDebrief({
      ...rawDebrief,
      session: {
        ...rawDebrief.session,
        score_total: 0,
        decision_count: 0,
      },
      decisions: [],
    })

    expect(parsed?.summary).toEqual({
      scoreTotal: 0,
      decisionCount: 0,
      classifications: {
        ideal: 0,
        acceptable: 0,
        needsImprovement: 0,
        unsafe: 0,
      },
    })
  })

  it.each([
    ['campo privado na raiz', { ...rawDebrief, truth: { answer: 'secret' } }],
    [
      'regra dentro da decisão',
      {
        ...rawDebrief,
        decisions: [
          { ...rawDebrief.decisions[0], correct: true },
          ...rawDebrief.decisions.slice(1),
        ],
      },
    ],
    [
      'classificação desconhecida',
      {
        ...rawDebrief,
        decisions: [
          { ...rawDebrief.decisions[0], classification: 'correct' },
          ...rawDebrief.decisions.slice(1),
        ],
      },
    ],
    [
      'URL não HTTP',
      {
        ...rawDebrief,
        references: [{ ...rawDebrief.references[0], url: 'javascript:alert(1)' }],
      },
    ],
    [
      'contagem divergente',
      {
        ...rawDebrief,
        session: { ...rawDebrief.session, decision_count: 3 },
      },
    ],
    [
      'trajetória fora de ordem',
      { ...rawDebrief, decisions: [...rawDebrief.decisions].reverse() },
    ],
  ])('rejeita %s', (_label, payload) => {
    expect(parseSimulationDebrief(payload)).toBeNull()
  })

  it('valida UUID antes de chamar o serviço', () => {
    expect(isValidDebriefSessionId(sessionId)).toBe(true)
    expect(isValidDebriefSessionId('not-a-session')).toBe(false)
    expect(isValidDebriefSessionId(null)).toBe(false)
  })
})

describe('leitura pedagógica', () => {
  it('credita ideal e acceptable sem converter a pontuação em porcentagem', () => {
    const parsed = parseSimulationDebrief(rawDebrief)
    expect(parsed).not.toBeNull()

    expect(isWellConducted('ideal')).toBe(true)
    expect(isWellConducted('acceptable')).toBe(true)
    expect(isWellConducted('needs_improvement')).toBe(false)
    expect(isWellConducted('unsafe')).toBe(false)
    expect(createDebriefSummary(-1, parsed?.decisions ?? [])).toEqual(
      parsed?.summary,
    )
  })
})

describe('serviço do debrief', () => {
  it('envia somente o session id à RPC dedicada', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: rawDebrief, error: null })
    const { getSimulationDebrief } = await import('../src/services/debrief')

    const result = await getSimulationDebrief(sessionId)

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('get_simulation_debrief', {
      p_session_id: sessionId,
    })
    expect(result.ok && result.debrief.summary.scoreTotal).toBe(-1)
  })

  it('não chama a rede para um identificador inválido', async () => {
    const { getSimulationDebrief } = await import('../src/services/debrief')
    const result = await getSimulationDebrief('invalid')

    expect(result).toMatchObject({ ok: false, reason: 'unavailable' })
    expect(supabaseMocks.rpc).not.toHaveBeenCalled()
  })

  it.each(['42501', 'P0001'])(
    'normaliza o erro seguro %s como indisponível',
    async (code) => {
      supabaseMocks.rpc.mockResolvedValue({ data: null, error: { code } })
      const { getSimulationDebrief } = await import('../src/services/debrief')

      await expect(getSimulationDebrief(sessionId)).resolves.toMatchObject({
        ok: false,
        reason: 'unavailable',
        message: 'Este resultado não está disponível.',
      })
    },
  )

  it('trata falha de rede ou payload inválido como erro recuperável', async () => {
    const { getSimulationDebrief } = await import('../src/services/debrief')
    supabaseMocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '08006', message: 'network' },
    })

    await expect(getSimulationDebrief(sessionId)).resolves.toMatchObject({
      ok: false,
      reason: 'error',
    })

    supabaseMocks.rpc.mockResolvedValueOnce({
      data: { ...rawDebrief, rules: 'private' },
      error: null,
    })
    await expect(getSimulationDebrief(sessionId)).resolves.toMatchObject({
      ok: false,
      reason: 'error',
    })
  })
})
