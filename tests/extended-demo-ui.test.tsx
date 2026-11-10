// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { transferableAbortController } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
vi.mock('../src/lib/dataMode', () => ({ isLocalMode: true }))
import { appRoutes } from '../src/app/routes'
import { extendedDemoCaseDefinitions } from '../src/features/teaching/extendedDemoCases'
import { loginLocal, localTeacherWorkspace } from '../src/features/teaching/localStore'
import { demoStudents, demoTeacher } from '../src/features/teaching/demoFixtures'

Object.defineProperty(globalThis, 'AbortController', { configurable: true, value: transferableAbortController().constructor })
const routers: ReturnType<typeof createMemoryRouter>[] = []
beforeEach(() => { localStorage.clear(); sessionStorage.clear() })
afterEach(() => { cleanup(); routers.splice(0).forEach(router => router.dispose()) })

describe('seleção e execução dos novos cenários', () => {
  for (const definition of extendedDemoCaseDefinitions) {
    const draft = definition.createDraft()
    it(draft.title, async () => {
      const user = userEvent.setup()
      loginLocal(demoStudents[draft.course === 'nursing' ? 2 : 5].email)
      const router = createMemoryRouter(appRoutes, { initialEntries: ['/curso'] })
      routers.push(router)
      render(<RouterProvider router={router} />)
      await user.click(await screen.findByRole('button', { name: draft.course === 'nursing' ? 'Escolher Enfermagem' : 'Escolher Análises Clínicas' }))
      await user.click(await screen.findByRole('button', { name: 'Entrar em uma turma' }))
      await user.click(screen.getByRole('link', { name: 'Acessar atividades da turma' }))
      expect(await screen.findByRole('heading', { name: 'Escolha seu próximo caso' })).toBeTruthy()
      expect(screen.getByText('7 etapas · 5 decisões')).toBeTruthy()
      await user.click(screen.getByRole('button', { name: 'Abrir caso: ' + draft.title }))
      await user.click(await screen.findByRole('button', { name: 'Iniciar caso' }))
      for (const step of draft.steps) {
        expect(await screen.findByRole('heading', { name: step.title })).toBeTruthy()
        if (step.type === 'decision') {
          await user.click(screen.getByRole('button', { name: step.options[0].label }))
          expect(await screen.findByText(step.options[0].feedback)).toBeTruthy()
        }
        await user.click(await screen.findByRole('button', { name: 'Continuar' }))
      }
      expect(await screen.findByRole('heading', { name: 'Debriefing da tentativa' })).toBeTruthy()
      expect(router.state.location.pathname).toBe('/resultado')
      expect(new URLSearchParams(router.state.location.search).get('atividade')).toBe(definition.assignmentId)
      expect(screen.getByText('Pontuação bruta').nextElementSibling?.textContent).toBe('10')
      expect(screen.getByText('Decisões avaliadas').nextElementSibling?.textContent).toBe('5')
      expect(screen.getAllByRole('link', { name: /Protocolo|recommendations|Consensus/ })).toHaveLength(2)
    })
  }

  it('abre um roteiro completo no editor do professor e salva uma cópia em rascunho', async () => {
    const user = userEvent.setup()
    loginLocal(demoTeacher.email, 'teacher')
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/professor/casos'] })
    routers.push(router)
    render(<RouterProvider router={router} />)
    await user.click(await screen.findByRole('button', { name: 'Usar roteiro: ' + extendedDemoCaseDefinitions[0].createDraft().title }))
    expect(await screen.findByRole('heading', { name: 'Novo caso clínico' })).toBeTruthy()
    expect((screen.getByLabelText('Título do caso') as HTMLInputElement).value).toBe(extendedDemoCaseDefinitions[0].createDraft().title)
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    expect(await screen.findByText('Rascunho salvo.')).toBeTruthy()
    const copy = localTeacherWorkspace().cases.find(item => item.status === 'draft' && item.draft.title === extendedDemoCaseDefinitions[0].createDraft().title)
    expect(copy?.draft.steps).toHaveLength(7)
    expect(copy?.draft.reviewed).toBe(false)
  })
})
