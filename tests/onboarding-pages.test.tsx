// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { transferableAbortController } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { AppShell } from '../src/components/AppShell'
import { CourseSelectionPage } from '../src/pages/CourseSelectionPage'
import { EntryPage } from '../src/pages/EntryPage'
import { NotFoundPage } from '../src/pages/NotFoundPage'
import { ResultPage } from '../src/pages/ResultPage'
import { SimulationPage } from '../src/pages/SimulationPage'

const NodeAbortController = transferableAbortController().constructor
Object.defineProperty(globalThis, 'AbortController', {
  configurable: true,
  value: NodeAbortController,
})

const serviceMocks = vi.hoisted(() => ({
  abandonSimulationSession: vi.fn(),
  ensureAnonymousStudentSession: vi.fn(),
  advanceSimulationSession: vi.fn(),
  getCurrentStudent: vi.fn(),
  getCurrentStudentCourse: vi.fn(),
  getSimulationDebrief: vi.fn(),
  getSimulationCase: vi.fn(),
  getVisibleCaseStepByKey: vi.fn(),
  recordSimulationDecision: vi.fn(),
  resolvePublishedCaseForCourse: vi.fn(),
  startOrResumeSimulationSession: vi.fn(),
  updateCurrentStudentCourse: vi.fn(),
}))

vi.mock('../src/services/auth', () => ({
  ensureAnonymousStudentSession: serviceMocks.ensureAnonymousStudentSession,
}))

vi.mock('../src/services/student', () => ({
  getCurrentStudent: serviceMocks.getCurrentStudent,
  getCurrentStudentCourse: serviceMocks.getCurrentStudentCourse,
  updateCurrentStudentCourse: serviceMocks.updateCurrentStudentCourse,
}))

vi.mock('../src/services/cases', () => ({
  getSimulationCase: serviceMocks.getSimulationCase,
  getVisibleCaseStepByKey: serviceMocks.getVisibleCaseStepByKey,
  resolvePublishedCaseForCourse: serviceMocks.resolvePublishedCaseForCourse,
}))

vi.mock('../src/services/simulationPersistence', () => ({
  abandonSimulationSession: serviceMocks.abandonSimulationSession,
  advanceSimulationSession: serviceMocks.advanceSimulationSession,
  recordSimulationDecision: serviceMocks.recordSimulationDecision,
  startOrResumeSimulationSession: serviceMocks.startOrResumeSimulationSession,
}))

vi.mock('../src/services/debrief', () => ({
  getSimulationDebrief: serviceMocks.getSimulationDebrief,
}))

vi.mock('../src/services/teaching', () => ({
  getPortalIdentity: vi.fn().mockResolvedValue({ ok: true, value: null }),
  getStudentWorkspace: vi.fn().mockResolvedValue({ ok: true, value: { assignments: [] } }),
}))

const session = {
  access_token: 'token',
  refresh_token: 'refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: '10000000-0000-4000-8000-000000000001' },
}

const nursingCase = {
  id: '20000000-0000-4000-8000-000000000001',
  slug: 'caso-enfermagem',
  title: 'Caso publicado de Enfermagem',
  course: 'nursing',
  description: 'Descrição visível do caso.',
  educationalObjective: 'Objetivo educacional visível.',
  status: 'published',
}

const simulationSteps = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    caseId: nursingCase.id,
    position: 1,
    stepKey: 'first-information',
    type: 'information' as const,
    title: 'Primeira informação',
    content: { body: 'Informação inicial.', observations: ['Primeira observação.'] },
    presentationState: 'stable' as const,
  },
  {
    id: '40000000-0000-4000-8000-000000000002',
    caseId: nursingCase.id,
    position: 2,
    stepKey: 'decision',
    type: 'decision' as const,
    title: 'Decisão de teste',
    content: { body: 'O que você faz?', observations: [] },
    options: [
      { id: 'ideal-option', label: 'Escolha segura' },
      { id: 'unsafe-option', label: 'Escolha arriscada' },
    ],
    presentationState: 'warning' as const,
  },
  {
    id: '40000000-0000-4000-8000-000000000003',
    caseId: nursingCase.id,
    position: 3,
    stepKey: 'final-information',
    type: 'information' as const,
    title: 'Continuidade',
    content: { body: 'Encerramento do caso.', observations: [] },
    presentationState: 'recovery' as const,
  },
]

const simulationCase = {
  case: nursingCase,
  patient: {
    id: '30000000-0000-4000-8000-000000000001',
    displayName: 'Paciente Teste',
    ageYears: 42,
    sexOrAnatomyContext: 'Contexto fictício de teste.',
    pronouns: null,
    visualRef: null,
  },
  firstStep: simulationSteps[0],
}

const simulationSessionId = '50000000-0000-4000-8000-000000000001'
let persistedScore = 0
let persistedDecisionCount = 0

function makeRecordedDecision(
  optionId: string,
  classification: 'ideal' | 'acceptable' | 'unsafe',
  scoreDelta: number,
  feedback: string,
  consequence: string | null,
  presentationState: 'critical' | 'recovery',
) {
  return {
    actionId: `action-${optionId}`,
    sessionId: simulationSessionId,
    stepId: simulationSteps[1].id,
    selectedOptionId: optionId,
    transition: {
      evaluation: {
        classification,
        scoreDelta,
        feedback,
        consequence,
      },
      nextStepKey: simulationSteps[2].stepKey,
      completed: false,
      presentationState,
    },
    scoreTotal: persistedScore,
    decisionCount: persistedDecisionCount,
    createdAt: '2026-09-04T20:01:00.000Z',
    replayed: false,
  }
}

function renderFlow(initialEntry = '/') {
  const router = createMemoryRouter(
    [
      { path: '/entrar', element: <EntryPage /> },
      { path: '/curso', element: <CourseSelectionPage /> },
      { path: '/simulacao', element: <SimulationPage /> },
      { path: '/resultado', element: <ResultPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
    { initialEntries: [initialEntry] },
  )

  render(<RouterProvider router={router} />)
  return router
}

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.clearAllMocks()
  persistedScore = 0
  persistedDecisionCount = 0
  serviceMocks.getCurrentStudent.mockResolvedValue({
    ok: true,
    student: { userId: session.user.id, role: 'student', course: null },
  })
  serviceMocks.resolvePublishedCaseForCourse.mockResolvedValue({
    ok: true,
    case: null,
    requestedCaseAccepted: false,
  })
  serviceMocks.getSimulationCase.mockResolvedValue({
    ok: true,
    simulationCase,
  })
  serviceMocks.getVisibleCaseStepByKey.mockImplementation(
    async (_caseId: string, stepKey: string) => ({
      ok: true,
      step: simulationSteps.find((step) => step.stepKey === stepKey),
    }),
  )
  serviceMocks.startOrResumeSimulationSession.mockResolvedValue({
    ok: true,
    session: {
      sessionId: simulationSessionId,
      caseId: nursingCase.id,
      status: 'in_progress',
      currentStepId: simulationSteps[0].id,
      currentStepKey: simulationSteps[0].stepKey,
      scoreTotal: 0,
      decisionCount: 0,
      startedAt: '2026-09-04T20:00:00.000Z',
      resumed: false,
      presentationState: 'stable',
      recordedDecision: null,
    },
  })
  serviceMocks.recordSimulationDecision.mockImplementation(
    async (_sessionId: string, _stepId: string, optionId: string) => {
      const unsafe = optionId === 'unsafe-option'
      persistedScore = unsafe ? -1 : 2
      persistedDecisionCount = 1

      return {
        ok: true,
        decision: makeRecordedDecision(
          optionId,
          unsafe ? 'unsafe' : 'ideal',
          unsafe ? -1 : 2,
          unsafe ? 'Essa escolha cria um risco evitável.' : 'Boa escolha.',
          unsafe ? 'A ação é interrompida.' : null,
          unsafe ? 'critical' : 'recovery',
        ),
      }
    },
  )
  serviceMocks.advanceSimulationSession.mockImplementation(
    async (_sessionId: string, stepId: string) => {
      const completed = stepId === simulationSteps[2].id
      const target =
        stepId === simulationSteps[0].id ? simulationSteps[1] : simulationSteps[2]

      return {
        ok: true,
        result: {
          sessionId: simulationSessionId,
          status: completed ? 'completed' : 'in_progress',
          currentStepId: target.id,
          currentStepKey: target.stepKey,
          scoreTotal: persistedScore,
          decisionCount: persistedDecisionCount,
          completedAt: completed ? '2026-09-04T20:02:00.000Z' : null,
          previousStepId: stepId,
          presentationState: completed ? null : target.presentationState,
          replayed: false,
        },
      }
    },
  )
  serviceMocks.getSimulationDebrief.mockImplementation(async () => ({
    ok: true,
    debrief: {
      sessionId: simulationSessionId,
      caseId: nursingCase.id,
      caseTitle: nursingCase.title,
      educationalObjective: nursingCase.educationalObjective,
      startedAt: '2026-09-04T20:00:00.000Z',
      completedAt: '2026-09-04T20:02:00.000Z',
      summary: {
        scoreTotal: persistedScore,
        decisionCount: persistedDecisionCount,
        classifications: {
          ideal: persistedScore > 0 ? persistedDecisionCount : 0,
          acceptable: 0,
          needsImprovement: 0,
          unsafe: persistedScore < 0 ? persistedDecisionCount : 0,
        },
      },
      decisions:
        persistedDecisionCount === 0
          ? []
          : [
              {
                actionId: '60000000-0000-4000-8000-000000000001',
                stepId: simulationSteps[1].id,
                stepKey: simulationSteps[1].stepKey,
                stepTitle: simulationSteps[1].title,
                position: simulationSteps[1].position,
                selectedOptionId:
                  persistedScore < 0 ? 'unsafe-option' : 'ideal-option',
                selectedOptionLabel:
                  persistedScore < 0 ? 'Escolha arriscada' : 'Escolha segura',
                classification: persistedScore < 0 ? 'unsafe' : 'ideal',
                scoreDelta: persistedScore,
                feedback:
                  persistedScore < 0
                    ? 'Essa escolha cria um risco evitável.'
                    : 'Boa escolha.',
                consequence:
                  persistedScore < 0 ? 'A ação é interrompida.' : null,
                createdAt: '2026-09-04T20:01:00.000Z',
              },
            ],
      references: [],
    },
  }))
})

describe('seleção de curso', () => {
  it('redireciona acesso direto sem autenticação para a entrada', async () => {
    serviceMocks.getCurrentStudent.mockResolvedValue({
      ok: false,
      reason: 'not_authenticated',
      message: 'Inicie como aluno para continuar.',
    })
    const router = renderFlow('/curso')

    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'))
  })

  it('persiste Enfermagem uma única vez durante clique duplo', async () => {
    serviceMocks.getCurrentStudent.mockResolvedValue({
      ok: true,
      student: { userId: session.user.id, role: 'student', course: null },
    })
    let resolveUpdate: ((value: unknown) => void) | undefined
    serviceMocks.updateCurrentStudentCourse.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve
      }),
    )
    const user = userEvent.setup()
    const router = renderFlow('/curso')
    const nursingButton = await screen.findByRole('button', { name: /Enfermagem/ })

    await user.dblClick(nursingButton)

    expect(serviceMocks.updateCurrentStudentCourse).toHaveBeenCalledTimes(1)
    expect(serviceMocks.updateCurrentStudentCourse).toHaveBeenCalledWith('nursing')

    resolveUpdate?.({ ok: true, course: 'nursing' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/participacao'))
  })

  it('persiste Análises Clínicas e segue para o handoff', async () => {
    serviceMocks.getCurrentStudent.mockResolvedValue({
      ok: true,
      student: {
        userId: session.user.id,
        role: 'student',
        course: 'clinical_analysis',
      },
    })
    serviceMocks.updateCurrentStudentCourse.mockResolvedValue({
      ok: true,
      course: 'clinical_analysis',
    })
    const user = userEvent.setup()
    const router = renderFlow('/curso')

    await user.click(await screen.findByRole('button', { name: /Análises Clínicas/ }))

    expect(serviceMocks.updateCurrentStudentCourse).toHaveBeenCalledWith(
      'clinical_analysis',
    )
    await waitFor(() => expect(router.state.location.pathname).toBe('/participacao'))
  })
})

describe('handoff da simulação', () => {
  it('redireciona acesso direto sem autenticação para a entrada', async () => {
    serviceMocks.getCurrentStudent.mockResolvedValue({
      ok: false,
      reason: 'not_authenticated',
      message: 'Inicie como aluno para continuar.',
    })
    const router = renderFlow('/simulacao')

    await waitFor(() => expect(router.state.location.pathname).toBe('/entrar'))
  })

  it('redireciona estudante sem curso para a seleção', async () => {
    serviceMocks.getCurrentStudent.mockResolvedValue({
      ok: true,
      student: { userId: session.user.id, role: 'student', course: null },
    })
    const router = renderFlow('/simulacao')

    await waitFor(() => expect(router.state.location.pathname).toBe('/curso'))
  })

  it('mostra estado vazio específico para o curso', async () => {
    serviceMocks.getCurrentStudent.mockResolvedValue({
      ok: true,
      student: { userId: session.user.id, role: 'student', course: 'nursing' },
    })
    serviceMocks.resolvePublishedCaseForCourse.mockResolvedValue({
      ok: true,
      case: null,
      requestedCaseAccepted: false,
    })
    renderFlow('/simulacao')

    expect(
      await screen.findByText(
        'Nenhum caso publicado está disponível para Enfermagem neste momento.',
      ),
    ).toBeTruthy()
  })

  it('mostra estado vazio específico para Análises Clínicas', async () => {
    serviceMocks.getCurrentStudent.mockResolvedValue({
      ok: true,
      student: {
        userId: session.user.id,
        role: 'student',
        course: 'clinical_analysis',
      },
    })
    serviceMocks.resolvePublishedCaseForCourse.mockResolvedValue({
      ok: true,
      case: null,
      requestedCaseAccepted: false,
    })
    renderFlow('/simulacao')

    expect(
      await screen.findByText(
        'Nenhum caso publicado está disponível para Análises Clínicas neste momento.',
      ),
    ).toBeTruthy()
    expect(serviceMocks.getSimulationCase).not.toHaveBeenCalled()
  })

  it('substitui case manipulado pelo caso publicado do curso', async () => {
    const manipulatedId = '20000000-0000-4000-8000-000000000002'
    serviceMocks.getCurrentStudent.mockResolvedValue({
      ok: true,
      student: { userId: session.user.id, role: 'student', course: 'nursing' },
    })
    serviceMocks.resolvePublishedCaseForCourse.mockResolvedValue({
      ok: true,
      case: nursingCase,
      requestedCaseAccepted: false,
    })
    const router = renderFlow(`/simulacao?case=${manipulatedId}`)

    expect(await screen.findByRole('heading', { name: nursingCase.title })).toBeTruthy()
    expect(serviceMocks.resolvePublishedCaseForCourse).toHaveBeenCalledWith(
      'nursing',
      manipulatedId,
    )
    await waitFor(() =>
      expect(router.state.location.search).toBe(`?case=${nursingCase.id}`),
    )
  })
})

describe('fatia vertical da simulação', () => {
  beforeEach(() => {
    serviceMocks.getCurrentStudent.mockResolvedValue({
      ok: true,
      student: { userId: session.user.id, role: 'student', course: 'nursing' },
    })
    serviceMocks.resolvePublishedCaseForCourse.mockResolvedValue({
      ok: true,
      case: nursingCase,
      requestedCaseAccepted: true,
    })
  })

  it('percorre etapas ordenadas, avalia uma escolha e envia o resumo ao resultado', async () => {
    const user = userEvent.setup()
    const router = renderFlow(`/simulacao?case=${nursingCase.id}`)

    expect(
      await screen.findByRole('heading', { name: 'Paciente Teste' }),
    ).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Iniciar caso' }))

    expect(screen.getByRole('heading', { name: 'Primeira informação' })).toBeTruthy()
    expect(screen.getByText('Etapa 1')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByRole('heading', { name: 'Decisão de teste' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Escolha segura' }))

    expect(serviceMocks.startOrResumeSimulationSession).toHaveBeenCalledWith(
      nursingCase.id,
      null,
    )
    expect(serviceMocks.recordSimulationDecision).toHaveBeenCalledWith(
      simulationSessionId,
      simulationSteps[1].id,
      'ideal-option',
    )
    expect(await screen.findByText('Escolha ideal')).toBeTruthy()
    expect(screen.getByText('Boa escolha.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByRole('heading', { name: 'Continuidade' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/resultado'))
    expect(router.state.location.search).toBe(`?session=${simulationSessionId}`)
    expect(
      await screen.findByRole('heading', { name: 'Debriefing da tentativa' }),
    ).toBeTruthy()
    expect(screen.getByText('Pontuação bruta').nextElementSibling?.textContent).toBe(
      '2',
    )
    expect(
      screen.getByText('Decisões avaliadas').nextElementSibling?.textContent,
    ).toBe('1')
  })

  it('mostra feedback não ideal devolvido pelo servidor', async () => {
    const user = userEvent.setup()
    const router = renderFlow(`/simulacao?case=${nursingCase.id}`)

    await user.click(await screen.findByRole('button', { name: 'Iniciar caso' }))
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(await screen.findByRole('button', { name: 'Escolha arriscada' }))

    expect(await screen.findByText('Escolha insegura')).toBeTruthy()
    expect(screen.getByText('Essa escolha cria um risco evitável.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(await screen.findByRole('button', { name: 'Continuar' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/resultado'))
    expect(await screen.findByText('-1')).toBeTruthy()
  })

  it('permite tentar novamente quando a RPC falha', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    serviceMocks.recordSimulationDecision.mockImplementation(
      vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          message: 'Não foi possível registrar sua escolha. Tente novamente.',
          cause: new Error('network'),
        })
        .mockResolvedValueOnce({
          ok: true,
          decision: {
            ...makeRecordedDecision(
              'ideal-option',
              'acceptable',
              1,
              'Escolha aceitável após nova tentativa.',
              null,
              'recovery',
            ),
            scoreTotal: 1,
            decisionCount: 1,
            replayed: true,
          },
        }),
    )
    const user = userEvent.setup()
    renderFlow(`/simulacao?case=${nursingCase.id}`)

    await user.click(await screen.findByRole('button', { name: 'Iniciar caso' }))
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(await screen.findByRole('button', { name: 'Escolha segura' }))
    await user.click(
      await screen.findByRole('button', { name: 'Tentar novamente' }),
    )

    expect(await screen.findByText('Escolha aceitável após nova tentativa.')).toBeTruthy()
    expect(serviceMocks.recordSimulationDecision).toHaveBeenCalledTimes(2)
    expect(consoleError).toHaveBeenCalledWith(
      'Falha ao persistir decisão.',
      expect.any(Error),
    )
    consoleError.mockRestore()
  })
})

describe('resultado e cabeçalho', () => {
  it('trata rota inexistente com 404 e retorno seguro', () => {
    renderFlow('/rota-inexistente')

    expect(screen.getByRole('heading', { name: 'Rota não encontrada' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Voltar para a entrada' })).toBeTruthy()
  })

  it('trata acesso direto ao resultado sem session id', async () => {
    renderFlow('/resultado')

    expect(
      await screen.findByRole('heading', {
        name: 'Resultado indisponível',
      }),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Voltar à simulação' })).toBeTruthy()
    expect(serviceMocks.getSimulationDebrief).not.toHaveBeenCalled()
  })

  it('oferece navegação pública e contextual sem expor rótulos de desenvolvimento', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '*',
          element: (
            <AppShell>
              <p>Conteúdo</p>
            </AppShell>
          ),
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'Como funciona' })[0].getAttribute('href')).toBe('/#como-funciona')
    const logo = screen.getByRole('link', { name: 'OSLER — página inicial' }).querySelector('img')
    expect(logo?.className).toBe('brand-logo')
    expect(logo?.getAttribute('style')).toBeNull()
    expect(screen.queryByText('MVP · Parte 10/10')).toBeNull()

    await router.navigate('/simulacao')
    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: 'Minha formação' }),
      ).toBeTruthy(),
    )
    expect(screen.getByRole('link', { name: 'Minha formação' }).getAttribute('href')).toBe('/curso')
    expect(screen.getByText('Ambiente educacional')).toBeTruthy()
  })
})
