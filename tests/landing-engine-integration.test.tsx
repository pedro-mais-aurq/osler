// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { transferableAbortController } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'

vi.mock('../src/lib/dataMode', () => ({ isLocalMode: true }))
import { appRoutes } from '../src/app/routes'
import { localIdentity, localStudentWorkspace } from '../src/features/teaching/localStore'

Object.defineProperty(globalThis, 'AbortController', {
  configurable: true,
  value: transferableAbortController().constructor,
})

const routers: ReturnType<typeof createMemoryRouter>[] = []
function open(path = '/') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  routers.push(router)
  render(<RouterProvider router={router} />)
  return router
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(() => { cleanup(); routers.splice(0).forEach(router => router.dispose()) })

describe('landing conectada ao motor e à sala de aula', () => {
  it('leva o aluno da landing ao caso, persiste decisões e preserva a atividade no debriefing', async () => {
    const user = userEvent.setup()
    const router = open()
    expect(localIdentity()).toBeNull()
    await user.click(screen.getByRole('link', { name: 'Começar a aprender' }))
    await user.click(await screen.findByRole('button', { name: /^Sou aluno/ }))
    expect(await screen.findByRole('heading', { name: 'Escolha seu curso' })).toBeTruthy()
    await user.click(await screen.findByRole('button', { name: 'Escolher Enfermagem' }))
    await user.click(await screen.findByRole('button', { name: 'Entrar em uma turma' }))
    await user.click(screen.getByRole('link', { name: 'Acessar atividades da turma' }))
    await user.click(await screen.findByRole('button', { name: 'Abrir caso: Segurança e comunicação no acolhimento' }))
    await user.click(await screen.findByRole('button', { name: 'Iniciar caso' }))
    const activity = new URLSearchParams(router.state.location.search).get('atividade')
    expect(activity).toBeTruthy()
    await user.click(await screen.findByRole('button', { name: 'Continuar' }))
    await user.click(await screen.findByRole('button', { name: /^Mantenho Luiza sentada/ }))
    expect(await screen.findByText('A escolha prioriza segurança e comunicação com o profissional responsável.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await user.click(await screen.findByRole('button', { name: /^Relato a tentativa de levantar/ }))
    await user.click(await screen.findByRole('button', { name: 'Continuar' }))
    expect(await screen.findByRole('heading', { name: 'Continuidade do cuidado' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByRole('heading', { name: 'Debriefing da tentativa' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/resultado')
    expect(new URLSearchParams(router.state.location.search).get('atividade')).toBe(activity)
    const sessionId = new URLSearchParams(router.state.location.search).get('session')
    const attempt = localStudentWorkspace().attempts.find(a => a.id === sessionId)
    expect(attempt).toMatchObject({ status: 'completed', scoreTotal: 4, decisionCount: 2, assignmentId: activity })
    expect(screen.getByRole('link', { name: 'Refazer este caso' }).getAttribute('href')).toContain('atividade=' + activity)
    const resultUrl = router.state.location.pathname + router.state.location.search
    cleanup()
    open(resultUrl)
    expect(await screen.findByRole('heading', { name: 'Debriefing da tentativa' })).toBeTruthy()
    await user.click(screen.getByRole('link', { name: 'Voltar às minhas atividades' }))
    expect(await screen.findByRole('heading', { name: 'Minhas atividades' })).toBeTruthy()
  })

  it('mantém Análises Clínicas escolhida na landing até o carregamento do caso real', async () => {
    const user = userEvent.setup()
    const router = open()
    await user.click(screen.getByRole('button', { name: 'Análises Clínicas' }))
    await user.click(screen.getByRole('link', { name: 'Explorar minha formação' }))
    expect(await screen.findByText('Sua formação:')).toBeTruthy()
    expect(router.state.location.search).toBe('?curso=clinical_analysis')
    await user.click(screen.getByRole('button', { name: /^Sou aluno/ }))
    expect(await screen.findByRole('heading', { name: 'Escolha seu curso' })).toBeTruthy()
    expect(router.state.location.search).toBe('?curso=clinical_analysis')
    expect((await screen.findByRole('button', { name: 'Escolher Análises Clínicas' })).getAttribute('aria-pressed')).toBe('true')
    await user.click(screen.getByRole('button', { name: 'Escolher Análises Clínicas' }))
    await user.click(await screen.findByRole('button', { name: 'Entrar em uma turma' }))
    await user.click(screen.getByRole('link', { name: 'Acessar atividades da turma' }))
    await user.click(await screen.findByRole('button', { name: 'Abrir caso: Identificação e rastreabilidade da amostra' }))
    expect(await screen.findByRole('heading', { name: 'Identificação e rastreabilidade da amostra' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/simulacao')
    expect(new URLSearchParams(router.state.location.search).get('atividade')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Iniciar caso' }))
    expect(await screen.findByRole('heading', { name: 'Recepção da amostra' })).toBeTruthy()
  })

  it('abre a gestão docente pela landing e permite voltar à apresentação sem perder a conta', async () => {
    const user = userEvent.setup()
    const router = open()
    await user.click(screen.getByRole('link', { name: 'Sou professor', hidden: true }))
    expect(await screen.findByRole('heading', { name: 'Como você quer entrar?' })).toBeTruthy()
    expect(router.state.location.search).toBe('?perfil=professor')
    await user.click(screen.getByRole('button', { name: /^Sou professor/ }))
    expect(await screen.findByRole('navigation', { name: 'Área do professor' })).toBeTruthy()
    await user.click(within(screen.getByRole('navigation', { name: 'Área do professor' })).getByRole('link', { name: 'Minhas turmas' }))
    expect(router.state.location.pathname).toBe('/professor/turmas')
    await user.click(screen.getByRole('link', { name: 'OSLER — página inicial' }))
    await user.click(screen.getByRole('link', { name: 'Meu espaço' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/professor'))
    expect(localIdentity()?.role).toBe('teacher')
  })

  it('permite escolher Análises Clínicas sem trocar a conta e praticar sem uma turma', async () => {
    const user = userEvent.setup()
    const router = open('/entrar')
    await user.click(await screen.findByRole('button', { name: /^Sou aluno/ }))
    expect(await screen.findByRole('heading', { name: 'Escolha seu curso' })).toBeTruthy()
    expect(localIdentity()?.email).toBe('ana@osler.demo')
    await user.click(await screen.findByRole('button', { name: 'Escolher Análises Clínicas' }))
    await user.click(await screen.findByRole('link', { name: 'Praticar sem turma' }))
    expect(await screen.findByRole('heading', { name: 'Casos públicos' })).toBeTruthy()
    await user.click(await screen.findByRole('link', { name: 'Praticar caso público: Amostra hemolisada: qualidade antes do resultado' }))
    expect(await screen.findByRole('heading', { name: 'Amostra hemolisada: qualidade antes do resultado' })).toBeTruthy()
    expect(localIdentity()?.email).toBe('ana@osler.demo')
    expect(router.state.location.pathname).toBe('/simulacao')
    expect(new URLSearchParams(router.state.location.search).get('atividade')).toBeNull()
    expect(new URLSearchParams(router.state.location.search).get('modo')).toBe('publico')
  })

  it.each(['/aluno', '/professor'])('orienta o visitante sem conta ao acessar %s diretamente', async path => {
    const router = open(path)
    expect(await screen.findByRole('heading', { name: 'Como você quer entrar?' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/entrar')
    expect(localIdentity()).toBeNull()
  })
})
