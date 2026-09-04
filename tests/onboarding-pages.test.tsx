// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { transferableAbortController } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { AppShell } from '../src/components/AppShell'
import { CourseSelectionPage } from '../src/pages/CourseSelectionPage'
import { EntryPage } from '../src/pages/EntryPage'
import { ResultPage } from '../src/pages/ResultPage'
import { SimulationPage } from '../src/pages/SimulationPage'
import { TeacherUnavailablePage } from '../src/pages/TeacherUnavailablePage'

const NodeAbortController = transferableAbortController().constructor
Object.defineProperty(globalThis, 'AbortController', {
  configurable: true,
  value: NodeAbortController,
})

const serviceMocks = vi.hoisted(() => ({
  ensureAnonymousStudentSession: vi.fn(),
  getCurrentStudent: vi.fn(),
  getCurrentStudentCourse: vi.fn(),
  getSimulationCase: vi.fn(),
  getVisibleCaseStepByKey: vi.fn(),
  resolvePublishedCaseForCourse: vi.fn(),
  resolveSimulationTransition: vi.fn(),
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

vi.mock('../src/services/simulation', () => ({
  resolveSimulationTransition: serviceMocks.resolveSimulationTransition,
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
  },
  firstStep: simulationSteps[0],
}

function renderFlow(initialEntry = '/') {
  const router = createMemoryRouter(
    [
      { path: '/', element: <EntryPage /> },
      { path: '/professor', element: <TeacherUnavailablePage /> },
      { path: '/curso', element: <CourseSelectionPage /> },
      { path: '/simulacao', element: <SimulationPage /> },
      { path: '/resultado', element: <ResultPage /> },
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
  serviceMocks.resolveSimulationTransition.mockImplementation(
    async (_caseId: string, stepId: string, optionId: string | null) => {
      if (stepId === simulationSteps[0].id) {
        return {
          ok: true,
          transition: {
            evaluation: null,
            nextStepKey: simulationSteps[1].stepKey,
            completed: false,
            presentationState: 'warning',
          },
        }
      }

      if (stepId === simulationSteps[2].id) {
        return {
          ok: true,
          transition: {
            evaluation: null,
            nextStepKey: null,
            completed: true,
            presentationState: null,
          },
        }
      }

      return {
        ok: true,
        transition: {
          evaluation: {
            classification: optionId === 'unsafe-option' ? 'unsafe' : 'ideal',
            scoreDelta: optionId === 'unsafe-option' ? -1 : 2,
            feedback:
              optionId === 'unsafe-option'
                ? 'Essa escolha cria um risco evitável.'
                : 'Boa escolha.',
            consequence:
              optionId === 'unsafe-option' ? 'A ação é interrompida.' : null,
          },
          nextStepKey: simulationSteps[2].stepKey,
          completed: false,
          presentationState: 'recovery',
        },
      }
    },
  )
})

describe('entrada e professor', () => {
  it('abre o placeholder do professor sem criar identidade', async () => {
    const user = userEvent.setup()
    const router = renderFlow()

    await user.click(screen.getByRole('link', { name: 'Sou professor' }))

    expect(router.state.location.pathname).toBe('/professor')
    expect(
      screen.getByRole('heading', { name: 'Área do professor em desenvolvimento' }),
    ).toBeTruthy()
    expect(serviceMocks.ensureAnonymousStudentSession).not.toHaveBeenCalled()
  })

  it('encaminha estudante novo para a escolha de curso', async () => {
    serviceMocks.ensureAnonymousStudentSession.mockResolvedValue({
      ok: true,
      session,
      user: session.user,
      created: true,
    })
    serviceMocks.getCurrentStudentCourse.mockResolvedValue({ ok: true, course: null })
    const user = userEvent.setup()
    const router = renderFlow()

    await user.click(screen.getByRole('button', { name: 'Sou aluno' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/curso'))
  })

  it('bloqueia operação concorrente durante clique duplo em Sou aluno', async () => {
    let resolveAuth: ((value: unknown) => void) | undefined
    serviceMocks.ensureAnonymousStudentSession.mockReturnValue(
      new Promise((resolve) => {
        resolveAuth = resolve
      }),
    )
    serviceMocks.getCurrentStudentCourse.mockResolvedValue({ ok: true, course: null })
    const user = userEvent.setup()
    renderFlow()

    await user.dblClick(screen.getByRole('button', { name: 'Sou aluno' }))

    expect(serviceMocks.ensureAnonymousStudentSession).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Iniciando sessão…' })).toBeTruthy()

    resolveAuth?.({ ok: true, session, user: session.user, created: true })
    expect(await screen.findByRole('heading', { name: 'Escolha seu curso' })).toBeTruthy()
  })

  it('pula a escolha quando o curso já está persistido', async () => {
    serviceMocks.ensureAnonymousStudentSession.mockResolvedValue({
      ok: true,
      session,
      user: session.user,
      created: false,
    })
    serviceMocks.getCurrentStudentCourse.mockResolvedValue({
      ok: true,
      course: 'clinical_analysis',
    })
    serviceMocks.getCurrentStudent.mockResolvedValue({
      ok: true,
      student: {
        userId: session.user.id,
        role: 'student',
        course: 'clinical_analysis',
      },
    })
    const user = userEvent.setup()
    const router = renderFlow()

    await user.click(screen.getByRole('button', { name: 'Sou aluno' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/simulacao'))
  })
})

describe('seleção de curso', () => {
  it('redireciona acesso direto sem autenticação para a entrada', async () => {
    serviceMocks.getCurrentStudent.mockResolvedValue({
      ok: false,
      reason: 'not_authenticated',
      message: 'Inicie como aluno para continuar.',
    })
    const router = renderFlow('/curso')

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
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
    await waitFor(() => expect(router.state.location.pathname).toBe('/simulacao'))
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
    await waitFor(() => expect(router.state.location.pathname).toBe('/simulacao'))
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

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
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

    expect(await screen.findByText('Paciente Teste')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Iniciar caso' }))

    expect(screen.getByRole('heading', { name: 'Primeira informação' })).toBeTruthy()
    expect(screen.getByText('Etapa 1')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByRole('heading', { name: 'Decisão de teste' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Escolha segura' }))

    expect(serviceMocks.resolveSimulationTransition).toHaveBeenCalledWith(
      nursingCase.id,
      simulationSteps[1].id,
      'ideal-option',
    )
    expect(await screen.findByText('Escolha ideal')).toBeTruthy()
    expect(screen.getByText('Boa escolha.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByRole('heading', { name: 'Continuidade' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/resultado'))
    expect(screen.getByRole('heading', { name: 'Resultado' })).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
  })

  it('mostra feedback não ideal devolvido pelo servidor', async () => {
    serviceMocks.resolveSimulationTransition.mockImplementation(
      async (_caseId: string, stepId: string) => {
        if (stepId === simulationSteps[0].id) {
          return {
            ok: true,
            transition: {
              evaluation: null,
              nextStepKey: simulationSteps[1].stepKey,
              completed: false,
              presentationState: 'warning',
            },
          }
        }

        if (stepId === simulationSteps[2].id) {
          return {
            ok: true,
            transition: {
              evaluation: null,
              nextStepKey: null,
              completed: true,
              presentationState: null,
            },
          }
        }

        return {
          ok: true,
          transition: {
            evaluation: {
              classification: 'unsafe',
              scoreDelta: -1,
              feedback: 'Essa escolha cria um risco evitável.',
              consequence: 'A ação é interrompida.',
            },
            nextStepKey: simulationSteps[2].stepKey,
            completed: false,
            presentationState: 'critical',
          },
        }
      },
    )
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
    expect(screen.getByText('-1')).toBeTruthy()
  })

  it('permite tentar novamente quando a RPC falha', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    serviceMocks.resolveSimulationTransition.mockImplementation(
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          transition: {
            evaluation: null,
            nextStepKey: simulationSteps[1].stepKey,
            completed: false,
            presentationState: 'warning',
          },
        })
        .mockResolvedValueOnce({
          ok: false,
          message: 'Não foi possível avaliar sua escolha. Tente novamente.',
          cause: new Error('network'),
        })
        .mockResolvedValueOnce({
          ok: true,
          transition: {
            evaluation: {
              classification: 'acceptable',
              scoreDelta: 1,
              feedback: 'Escolha aceitável após nova tentativa.',
              consequence: null,
            },
            nextStepKey: simulationSteps[2].stepKey,
            completed: false,
            presentationState: 'recovery',
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
    expect(serviceMocks.resolveSimulationTransition).toHaveBeenCalledTimes(3)
    expect(consoleError).toHaveBeenCalledWith(
      'Falha ao resolver transição da simulação.',
      expect.any(Error),
    )
    consoleError.mockRestore()
  })
})

describe('resultado e cabeçalho', () => {
  it('trata acesso direto ao resultado sem estado de navegação', () => {
    renderFlow('/resultado')

    expect(
      screen.getByRole('heading', {
        name: 'Nenhum resultado de simulação disponível',
      }),
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Voltar à simulação' })).toBeTruthy()
  })

  it('oculta a navegação de desenvolvimento apenas na entrada', async () => {
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

    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).toBeNull()
    const logo = screen.getByRole('link', { name: 'OSLER — ir para a entrada' }).querySelector('img')
    expect(logo?.className).toBe('brand-logo')
    expect(logo?.getAttribute('style')).toBeNull()

    await router.navigate('/simulacao')
    await waitFor(() =>
      expect(
        screen.getByRole('navigation', { name: 'Navegação principal' }),
      ).toBeTruthy(),
    )
  })
})
