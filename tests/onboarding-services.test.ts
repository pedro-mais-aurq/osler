// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  getSession: vi.fn(),
  rpc: vi.fn(),
  signInAnonymously: vi.fn(),
}))

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: supabaseMocks.getSession,
      signInAnonymously: supabaseMocks.signInAnonymously,
    },
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
  },
  supabaseConfigurationError: null,
}))

vi.mock('../src/services/auth', async (importOriginal) => {
  return importOriginal()
})

const userId = '10000000-0000-4000-8000-000000000001'
const session = {
  access_token: 'token',
  refresh_token: 'refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: userId },
}

function createBuilder(result: unknown = null) {
  const filters: Array<[string, unknown]> = []
  const orders: Array<[string, unknown]> = []
  let updateBody: unknown = null

  const builder = {
    filters,
    orders,
    get updateBody() {
      return updateBody
    },
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      filters.push([column, value])
      return builder
    }),
    gt: vi.fn((column: string, value: unknown) => {
      filters.push([column, value])
      return builder
    }),
    order: vi.fn((column: string, options: unknown) => {
      orders.push([column, options])
      return builder
    }),
    limit: vi.fn(() => builder),
    update: vi.fn((body: unknown) => {
      updateBody = body
      return builder
    }),
    maybeSingle: vi.fn(async () => ({ data: result, error: null })),
    single: vi.fn(async () => ({ data: result, error: null })),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: result, error: null }).then(resolve),
  }

  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
  supabaseMocks.getSession.mockResolvedValue({ data: { session }, error: null })
})

describe('serviço de autenticação', () => {
  it('reutiliza sessão existente sem criar outro auth user', async () => {
    const { ensureAnonymousStudentSession } = await import('../src/services/auth')

    const result = await ensureAnonymousStudentSession()

    expect(result.ok).toBe(true)
    expect(result.ok && result.created).toBe(false)
    expect(supabaseMocks.signInAnonymously).not.toHaveBeenCalled()
  })

  it('deduplica chamadas simultâneas de anonymous sign-in', async () => {
    vi.resetModules()
    supabaseMocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
    supabaseMocks.signInAnonymously.mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    })
    const { ensureAnonymousStudentSession } = await import('../src/services/auth')

    const first = ensureAnonymousStudentSession()
    const second = ensureAnonymousStudentSession()
    const [firstResult, secondResult] = await Promise.all([first, second])

    expect(first).toBe(second)
    expect(firstResult.ok && firstResult.created).toBe(true)
    expect(secondResult.ok && secondResult.created).toBe(true)
    expect(supabaseMocks.signInAnonymously).toHaveBeenCalledTimes(1)
  })
})

describe('serviço de estudante', () => {
  it('atualiza somente o curso do usuário da sessão e nunca faz insert', async () => {
    const profileBuilder = createBuilder({ user_id: userId, role: 'student' })
    const studentReadBuilder = createBuilder({ user_id: userId, course: null })
    const studentUpdateBuilder = createBuilder({ course: 'clinical_analysis' })
    let studentCall = 0

    supabaseMocks.from.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return profileBuilder
      }

      studentCall += 1
      return studentCall === 1 ? studentReadBuilder : studentUpdateBuilder
    })

    const { updateCurrentStudentCourse } = await import('../src/services/student')
    const result = await updateCurrentStudentCourse('clinical_analysis')

    expect(result).toEqual({ ok: true, course: 'clinical_analysis' })
    expect(studentUpdateBuilder.updateBody).toEqual({ course: 'clinical_analysis' })
    expect(studentUpdateBuilder.filters).toContainEqual(['user_id', userId])
    expect(supabaseMocks.from.mock.calls.map(([table]) => table)).toEqual([
      'profiles',
      'students',
      'students',
    ])
  })
})

describe('serviço de casos', () => {
  it('filtra primeiro caso no banco por published e course com ordem determinística', async () => {
    const caseRow = {
      id: '20000000-0000-4000-8000-000000000001',
      slug: 'caso-enfermagem',
      title: 'Caso de Enfermagem',
      course: 'nursing',
      description: 'Descrição',
      educational_objective: null,
      status: 'published',
    }
    const builder = createBuilder(caseRow)
    supabaseMocks.from.mockReturnValue(builder)
    const { getFirstPublishedCaseForCourse } = await import('../src/services/cases')

    const result = await getFirstPublishedCaseForCourse('nursing')

    expect(result.ok && result.case).toEqual(caseRow)
    expect(builder.filters).toEqual([
      ['status', 'published'],
      ['course', 'nursing'],
    ])
    expect(builder.orders).toEqual([
      ['created_at', { ascending: true }],
      ['id', { ascending: true }],
    ])
    expect(builder.limit).toHaveBeenCalledWith(1)
    expect(supabaseMocks.from).toHaveBeenCalledWith('clinical_cases')
  })

  it('rejeita case de outro curso e resolve novamente sem consultar dados privados', async () => {
    const requestedBuilder = createBuilder(null)
    const fallbackCase = {
      id: '20000000-0000-4000-8000-000000000001',
      slug: 'caso-enfermagem',
      title: 'Caso de Enfermagem',
      course: 'nursing',
      description: 'Descrição',
      educational_objective: null,
      status: 'published',
    }
    const fallbackBuilder = createBuilder(fallbackCase)
    supabaseMocks.from
      .mockReturnValueOnce(requestedBuilder)
      .mockReturnValueOnce(fallbackBuilder)
    const { resolvePublishedCaseForCourse } = await import('../src/services/cases')

    const result = await resolvePublishedCaseForCourse(
      'nursing',
      '20000000-0000-4000-8000-000000000002',
    )

    expect(result.ok && result.case).toEqual(fallbackCase)
    expect(result.ok && result.requestedCaseAccepted).toBe(false)
    expect(requestedBuilder.filters).toEqual([
      ['id', '20000000-0000-4000-8000-000000000002'],
      ['status', 'published'],
      ['course', 'nursing'],
    ])
    expect(supabaseMocks.from.mock.calls.map(([table]) => table)).toEqual([
      'clinical_cases',
      'clinical_cases',
    ])
  })

  it('carrega a simulação somente das tabelas públicas visíveis e ordena as etapas', async () => {
    const caseRow = {
      id: '20000000-0000-4000-8000-000000000001',
      patient_id: '30000000-0000-4000-8000-000000000001',
      slug: 'caso-enfermagem',
      title: 'Caso de Enfermagem',
      course: 'nursing',
      description: 'Descrição',
      educational_objective: null,
      status: 'published',
    }
    const patientRow = {
      id: caseRow.patient_id,
      display_name: 'Paciente Teste',
      age_years: 45,
      sex_or_anatomy_context: null,
      pronouns: null,
    }
    const stepRow = {
      id: '40000000-0000-4000-8000-000000000001',
      case_id: caseRow.id,
      position: 1,
      step_key: 'intro',
      step_type: 'information',
      title: 'Introdução',
      content: { body: 'Texto visível.', observations: [] },
      options: [],
    }
    const caseBuilder = createBuilder(caseRow)
    const patientBuilder = createBuilder(patientRow)
    const stepsBuilder = createBuilder(stepRow)
    supabaseMocks.from
      .mockReturnValueOnce(caseBuilder)
      .mockReturnValueOnce(patientBuilder)
      .mockReturnValueOnce(stepsBuilder)
    const { getSimulationCase } = await import('../src/services/cases')

    const result = await getSimulationCase(caseRow.id, 'nursing')

    expect(result.ok && result.simulationCase.patient).toEqual(patientRow)
    expect(result.ok && result.simulationCase.steps).toEqual([stepRow])
    expect(supabaseMocks.from.mock.calls.map(([table]) => table)).toEqual([
      'clinical_cases',
      'patients',
      'case_steps',
    ])
    expect(stepsBuilder.filters).toEqual([['case_id', caseRow.id]])
    expect(stepsBuilder.orders).toEqual([['position', { ascending: true }]])
    expect(stepsBuilder.limit).toHaveBeenCalledWith(1)
  })

  it('carrega somente a próxima posição visível sem antecipar etapas futuras', async () => {
    const nextStep = {
      id: '40000000-0000-4000-8000-000000000002',
      case_id: '20000000-0000-4000-8000-000000000001',
      position: 4,
      step_key: 'next-step',
      step_type: 'information',
      title: 'Próxima etapa',
      content: { body: 'Informação progressiva.', observations: [] },
      options: [],
    }
    const builder = createBuilder(nextStep)
    supabaseMocks.from.mockReturnValue(builder)
    const { getNextVisibleCaseStep } = await import('../src/services/cases')

    const result = await getNextVisibleCaseStep(nextStep.case_id, 2)

    expect(result).toEqual({ ok: true, step: nextStep })
    expect(supabaseMocks.from.mock.calls.map(([table]) => table)).toEqual([
      'case_steps',
    ])
    expect(builder.filters).toEqual([
      ['case_id', nextStep.case_id],
      ['position', 2],
    ])
    expect(builder.orders).toEqual([['position', { ascending: true }]])
    expect(builder.limit).toHaveBeenCalledWith(1)
  })
})

describe('serviço de avaliação', () => {
  it('envia apenas os identificadores à RPC e normaliza a resposta mínima', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: [
        {
          classification: 'ideal',
          score_delta: 2,
          feedback: 'Feedback selecionado.',
          consequence: null,
        },
      ],
      error: null,
    })
    const { evaluateCaseStep } = await import('../src/services/simulation')

    const result = await evaluateCaseStep('case-id', 'step-id', 'option-id')

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('evaluate_case_step', {
      p_case_id: 'case-id',
      p_step_id: 'step-id',
      p_option_id: 'option-id',
    })
    expect(result).toEqual({
      ok: true,
      evaluation: {
        classification: 'ideal',
        scoreDelta: 2,
        feedback: 'Feedback selecionado.',
        consequence: null,
      },
    })
    expect(supabaseMocks.from).not.toHaveBeenCalled()
  })
})
