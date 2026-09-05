// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import type { SimulationDebrief } from '../src/features/debrief/types'
import { ResultPage } from '../src/pages/ResultPage'

const serviceMocks = vi.hoisted(() => ({ getSimulationDebrief: vi.fn() }))

vi.mock('../src/services/debrief', () => ({
  getSimulationDebrief: serviceMocks.getSimulationDebrief,
}))

const sessionId = 'a1000000-0000-4000-8000-000000000001'
const caseId = 'a2000000-0000-4000-8000-000000000001'

const debrief: SimulationDebrief = {
  sessionId,
  caseId,
  caseTitle: 'Conferência pré-analítica de amostra',
  educationalObjective: 'Revisar identificação e rastreabilidade.',
  startedAt: '2026-09-05T12:00:00.000Z',
  completedAt: '2026-09-05T12:08:00.000Z',
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
  decisions: [
    {
      actionId: 'a3000000-0000-4000-8000-000000000001',
      stepId: 'a4000000-0000-4000-8000-000000000001',
      stepKey: 'check-request',
      stepTitle: 'Conferência da solicitação',
      position: 2,
      selectedOptionId: 'compare-data',
      selectedOptionLabel: 'Comparar os identificadores disponíveis',
      classification: 'ideal',
      scoreDelta: 2,
      feedback: 'A conferência preservou a rastreabilidade.',
      consequence: null,
      createdAt: '2026-09-05T12:02:00.000Z',
    },
    {
      actionId: 'a3000000-0000-4000-8000-000000000002',
      stepId: 'a4000000-0000-4000-8000-000000000002',
      stepKey: 'document-action',
      stepTitle: 'Registro técnico',
      position: 3,
      selectedOptionId: 'document',
      selectedOptionLabel: 'Registrar a não conformidade',
      classification: 'acceptable',
      scoreDelta: 1,
      feedback: 'A decisão foi adequada para esta tentativa.',
      consequence: 'O registro técnico fica disponível para o fluxo seguro.',
      createdAt: '2026-09-05T12:03:00.000Z',
    },
    {
      actionId: 'a3000000-0000-4000-8000-000000000003',
      stepId: 'a4000000-0000-4000-8000-000000000003',
      stepKey: 'communicate',
      stepTitle: null,
      position: 4,
      selectedOptionId: 'wait',
      selectedOptionLabel: 'Aguardar sem comunicar',
      classification: 'needs_improvement',
      scoreDelta: 0,
      feedback: 'A comunicação poderia ter sido mais oportuna.',
      consequence: null,
      createdAt: '2026-09-05T12:04:00.000Z',
    },
    {
      actionId: 'a3000000-0000-4000-8000-000000000004',
      stepId: 'a4000000-0000-4000-8000-000000000004',
      stepKey: 'release',
      stepTitle: 'Encaminhamento do resultado',
      position: 5,
      selectedOptionId: 'release-alone',
      selectedOptionLabel: 'Liberar autonomamente',
      classification: 'unsafe',
      scoreDelta: -4,
      feedback: 'O resultado técnico exige o fluxo de validação apropriado.',
      consequence: 'A liberação é interrompida.',
      createdAt: '2026-09-05T12:05:00.000Z',
    },
  ],
  references: [
    {
      id: 'anvisa-test',
      authority: 'Anvisa',
      title: 'Referência sanitária pública do caso',
      year: 2026,
      url: 'https://www.gov.br/anvisa/',
      verifiedOn: '2026-09-05',
    },
  ],
}

function renderResult(
  initialEntry:
    | string
    | { pathname: string; search?: string; state?: unknown } =
    `/resultado?session=${sessionId}`,
) {
  const router = createMemoryRouter(
    [
      { path: '/resultado', element: <ResultPage /> },
      { path: '/simulacao', element: <p>Simulação</p> },
      { path: '/curso', element: <p>Seleção</p> },
    ],
    { initialEntries: [initialEntry] },
  )

  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  vi.clearAllMocks()
  serviceMocks.getSimulationDebrief.mockResolvedValue({ ok: true, debrief })
})

afterEach(() => {
  cleanup()
})

describe('ResultPage server-authoritative', () => {
  it('carrega o debrief pelo session id e apresenta as quatro classificações', async () => {
    renderResult()

    expect(screen.getByRole('status').textContent).toContain('Carregando')
    expect(
      await screen.findByRole('heading', { name: 'Debriefing da tentativa' }),
    ).toBeTruthy()
    expect(serviceMocks.getSimulationDebrief).toHaveBeenCalledWith(sessionId)
    expect(screen.getByText(debrief.caseTitle)).toBeTruthy()
    expect(screen.getByText('Revisar identificação e rastreabilidade.')).toBeTruthy()

    const summary = screen.getByRole('heading', {
      name: 'Resumo da tentativa',
    }).parentElement?.parentElement
    expect(summary).toBeTruthy()
    expect(within(summary as HTMLElement).getByText('Pontuação bruta')).toBeTruthy()
    expect(within(summary as HTMLElement).getAllByText('1')).toHaveLength(4)
    expect(screen.getAllByText('Muito adequada').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Adequada').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ponto de melhoria').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Atenção de segurança').length).toBeGreaterThan(0)
  })

  it('mostra a trajetória histórica completa e separa consequência de feedback', async () => {
    renderResult()
    await screen.findByRole('heading', { name: 'Trajetória de decisões' })

    const trajectory = screen
      .getByRole('heading', { name: 'Trajetória de decisões' })
      .closest('section')
    expect(trajectory).toBeTruthy()
    const cards = within(trajectory as HTMLElement).getAllByRole('article')
    expect(cards).toHaveLength(4)
    expect(cards[0].textContent).toContain('Comparar os identificadores disponíveis')
    expect(cards[0].textContent).toContain(
      'A conferência preservou a rastreabilidade.',
    )
    expect(cards[1].textContent).toContain('Consequência no cenário')
    expect(cards[1].textContent).toContain(
      'O registro técnico fica disponível para o fluxo seguro.',
    )
    expect(cards[3].textContent).toContain('Variação na pontuação: -4')
  })

  it('apresenta referências sanitizadas e links seguros', async () => {
    renderResult()
    const referenceLink = await screen.findByRole('link', {
      name: 'Referência sanitária pública do caso — abrir referência em nova aba',
    })

    expect(referenceLink.getAttribute('href')).toBe('https://www.gov.br/anvisa/')
    expect(referenceLink.getAttribute('target')).toBe('_blank')
    expect(referenceLink.getAttribute('rel')).toContain('noopener')
    expect(screen.getByText('Fonte verificada em 05/09/2026')).toBeTruthy()
  })

  it('não transforma score em porcentagem, nota ou competência geral', async () => {
    renderResult()
    await screen.findByText('Pontuação bruta')

    expect(screen.getByText('-1')).toBeTruthy()
    expect(screen.queryByText(/%/)).toBeNull()
    expect(screen.queryByText(/aprovado|reprovado/i)).toBeNull()
    expect(screen.getByText(/não representam uma nota escolar/i)).toBeTruthy()
    expect(screen.getByText(/competência profissional geral/i)).toBeTruthy()
  })

  it('mantém ações acessíveis sem apagar a tentativa histórica', async () => {
    renderResult()
    const retryLink = await screen.findByRole('link', {
      name: 'Refazer este caso',
    })

    expect(retryLink.getAttribute('href')).toBe(`/simulacao?case=${caseId}`)
    expect(screen.getByRole('link', { name: 'Voltar à seleção' })).toBeTruthy()
    expect(screen.getByText(/sem apagar a tentativa concluída/i)).toBeTruthy()
  })

  it.each([
    ['/resultado', 'session ausente'],
    ['/resultado?session=invalid', 'session inválida'],
  ])('usa indisponibilidade segura com %s (%s)', async (entry) => {
    renderResult(entry)

    expect(
      await screen.findByRole('heading', { name: 'Resultado indisponível' }),
    ).toBeTruthy()
    expect(screen.getByText('Este resultado não está disponível.')).toBeTruthy()
    expect(serviceMocks.getSimulationDebrief).not.toHaveBeenCalled()
  })

  it('não confia em um resultado forjado no navigation state', async () => {
    renderResult({
      pathname: '/resultado',
      state: {
        sessionId,
        score: 999,
        truth: 'forged',
      },
    })

    expect(
      await screen.findByRole('heading', { name: 'Resultado indisponível' }),
    ).toBeTruthy()
    expect(screen.queryByText('999')).toBeNull()
    expect(serviceMocks.getSimulationDebrief).not.toHaveBeenCalled()
  })

  it('usa a mesma mensagem segura para tentativas alheias ou não concluídas', async () => {
    serviceMocks.getSimulationDebrief.mockResolvedValue({
      ok: false,
      reason: 'unavailable',
      message: 'Este resultado não está disponível.',
    })
    renderResult()

    expect(
      await screen.findByRole('heading', { name: 'Resultado indisponível' }),
    ).toBeTruthy()
    expect(screen.getByText('Este resultado não está disponível.')).toBeTruthy()
  })

  it('permite repetir uma falha transitória preservando a URL', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    serviceMocks.getSimulationDebrief
      .mockResolvedValueOnce({
        ok: false,
        reason: 'error',
        message: 'Não foi possível carregar este debrief. Tente novamente.',
        cause: new Error('network'),
      })
      .mockResolvedValueOnce({ ok: true, debrief })
    const router = renderResult()
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole('button', { name: 'Tentar novamente' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Debriefing da tentativa' }),
    ).toBeTruthy()
    expect(serviceMocks.getSimulationDebrief).toHaveBeenCalledTimes(2)
    expect(router.state.location.search).toBe(`?session=${sessionId}`)
    consoleError.mockRestore()
  })

  it('reconstrói a tentativa ao remontar a mesma URL como em um refresh', async () => {
    const first = renderResult()
    await screen.findByRole('heading', { name: 'Debriefing da tentativa' })
    expect(first.state.location.search).toBe(`?session=${sessionId}`)

    cleanup()
    renderResult()
    await screen.findByRole('heading', { name: 'Debriefing da tentativa' })

    expect(serviceMocks.getSimulationDebrief).toHaveBeenCalledTimes(2)
  })

  it('trata honestamente uma tentativa sem decisões e sem referências', async () => {
    serviceMocks.getSimulationDebrief.mockResolvedValue({
      ok: true,
      debrief: {
        ...debrief,
        summary: {
          scoreTotal: 0,
          decisionCount: 0,
          classifications: {
            ideal: 0,
            acceptable: 0,
            needsImprovement: 0,
            unsafe: 0,
          },
        },
        decisions: [],
        references: [],
      },
    })
    renderResult()

    expect(
      await screen.findByText('Esta tentativa foi concluída sem decisões avaliadas.'),
    ).toBeTruthy()
    expect(
      screen.getByText('Nenhuma referência pública foi disponibilizada para este caso.'),
    ).toBeTruthy()
  })
})
