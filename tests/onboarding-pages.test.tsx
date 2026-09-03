// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { transferableAbortController } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { CourseSelectionPage } from '../src/pages/CourseSelectionPage'
import { EntryPage } from '../src/pages/EntryPage'
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
  resolvePublishedCaseForCourse: vi.fn(),
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
  resolvePublishedCaseForCourse: serviceMocks.resolvePublishedCaseForCourse,
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
  educational_objective: 'Objetivo educacional visível.',
  status: 'published',
}

function renderFlow(initialEntry = '/') {
  const router = createMemoryRouter(
    [
      { path: '/', element: <EntryPage /> },
      { path: '/professor', element: <TeacherUnavailablePage /> },
      { path: '/curso', element: <CourseSelectionPage /> },
      { path: '/simulacao', element: <SimulationPage /> },
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
