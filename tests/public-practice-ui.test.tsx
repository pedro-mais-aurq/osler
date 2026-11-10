// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { transferableAbortController } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
vi.mock('../src/lib/dataMode', () => ({ isLocalMode: true }))
import { appRoutes } from '../src/app/routes'
import * as local from '../src/features/teaching/localStore'
import { demoTeacher, demoStudents } from '../src/features/teaching/demoFixtures'
import { respiratoryDeterioration } from '../src/features/teaching/practiceCases/respiratoryDeterioration'
import { positiveBloodCultures } from '../src/features/teaching/practiceCases/positiveBloodCultures'

Object.defineProperty(globalThis, 'AbortController', { configurable: true, value: transferableAbortController().constructor })
const routers: ReturnType<typeof createMemoryRouter>[] = []
function open(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  routers.push(router)
  render(<RouterProvider router={router} />)
  return router
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(() => { cleanup(); routers.splice(0).forEach(router => router.dispose()) })

describe('entrada opcional em turma e prática pública', () => {
  it('percorre o acesso sem turma, conclui um caso público e reencontra seu debriefing no histórico individual', async () => {
    const user = userEvent.setup()
    const definition = respiratoryDeterioration, draft = definition.createDraft()
    const router = open('/entrar')
    const email = await screen.findByRole('combobox', { name: 'E-mail do aluno para experimentar' })
    await user.clear(email)
    await user.type(email, 'aprendiz.sem.turma@osler.demo')
    await user.click(screen.getByRole('button', { name: /^Sou aluno/ }))
    await user.click(await screen.findByRole('button', { name: 'Escolher Enfermagem' }))
    expect(await screen.findByRole('heading', { name: 'Como você quer aprender?' })).toBeTruthy()
    await user.click(await screen.findByRole('link', { name: 'Praticar sem turma' }))
    expect(await screen.findByRole('heading', { name: 'Casos públicos' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Segurança e comunicação no acolhimento' })).toBeNull()
    await user.click(await screen.findByRole('link', { name: 'Praticar caso público: ' + draft.title }))
    expect(new URLSearchParams(router.state.location.search).get('atividade')).toBeNull()
    await user.click(await screen.findByRole('button', { name: 'Iniciar caso' }))
    for (const step of draft.steps) {
      expect(await screen.findByRole('heading', { name: step.title })).toBeTruthy()
      if (step.type === 'decision') await user.click(screen.getByRole('button', { name: step.options[0].label }))
      await user.click(await screen.findByRole('button', { name: 'Continuar' }))
    }
    expect(await screen.findByRole('heading', { name: 'Debriefing da tentativa' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Refazer este caso' }).getAttribute('href')).toContain('modo=publico')
    const sessionId = new URLSearchParams(router.state.location.search).get('session')
    await user.click(screen.getByRole('link', { name: 'Ver casos públicos' }))
    expect(await screen.findByRole('link', { name: 'Ver debriefing' })).toBeTruthy()
    expect(local.localStudentWorkspace().classrooms).toHaveLength(0)
    expect(local.localPublicPractice('nursing').attempts.find(item => item.id === sessionId)?.assignmentId).toBeNull()
    await user.click(screen.getByRole('link', { name: 'Ver debriefing' }))
    expect(await screen.findByRole('heading', { name: 'Debriefing da tentativa' })).toBeTruthy()
  })

  it('entra em uma turma por código e seleciona o curso da turma sem trocar de identidade', async () => {
    const user = userEvent.setup()
    local.loginLocal(demoTeacher.email, 'teacher')
    const classroom = local.localTeacherWorkspace().classrooms.find(item => item.course === 'clinical_analysis')!
    local.loginLocal('novo.por.codigo@osler.demo')
    local.localSetCourse('nursing')
    open('/participacao')
    await user.click(await screen.findByRole('button', { name: 'Entrar em uma turma' }))
    await user.type(screen.getByRole('textbox', { name: 'Código da turma' }), classroom.joinCode!.toLowerCase())
    await user.click(screen.getByRole('button', { name: 'Confirmar entrada' }))
    expect(await screen.findByRole('heading', { name: 'Minhas atividades' })).toBeTruthy()
    expect(local.localStudent().course).toBe('clinical_analysis')
    expect(local.localIdentity()?.email).toBe('novo.por.codigo@osler.demo')
    expect(local.localStudentWorkspace().classrooms.map(item => item.id)).toContain(classroom.id)
  })

  it('apresenta privado por padrão no editor e salva a seleção público sem publicar o rascunho', async () => {
    const user = userEvent.setup()
    local.loginLocal(demoTeacher.email, 'teacher')
    open('/professor/casos')
    const draft = positiveBloodCultures.createDraft()
    await user.click(await screen.findByRole('button', { name: 'Usar roteiro: ' + draft.title }))
    const visibility = await screen.findByRole('combobox', { name: 'Visibilidade do caso' })
    expect((visibility as HTMLSelectElement).value).toBe('private')
    await user.selectOptions(visibility, 'public')
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    expect(await screen.findByText('Rascunho salvo.')).toBeTruthy()
    const saved = local.localTeacherWorkspace().cases.find(item => item.status === 'draft' && item.draft.visibility === 'public')
    expect(saved?.draft.title).toBe(draft.title)
    expect(saved?.draft.steps).toHaveLength(12)
  })

  it('não inicia um caso privado pelo caminho de prática individual mesmo que o aluno pertença à turma', async () => {
    local.loginLocal(demoTeacher.email, 'teacher')
    const privateCase = local.localTeacherWorkspace().cases.find(item => item.status === 'published' && item.draft.visibility === 'private' && item.draft.course === 'nursing')!
    local.loginLocal(demoStudents[0].email)
    local.localSetCourse('nursing')
    open(`/simulacao?case=${privateCase.id}&modo=publico`)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Este caso não está disponível para prática individual.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Iniciar caso' })).toBeNull()
  })
})
