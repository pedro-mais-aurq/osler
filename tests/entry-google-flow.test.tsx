// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { transferableAbortController } from 'node:util'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
const mocks = vi.hoisted(() => ({ identity: vi.fn(), login: vi.fn(), course: vi.fn() }))
vi.mock('../src/lib/dataMode', () => ({ isLocalMode: false }))
vi.mock('../src/services/teaching', () => ({ getPortalIdentity: mocks.identity, signInWithGoogle: mocks.login }))
vi.mock('../src/services/student', () => ({ updateCurrentStudentCourse: mocks.course }))
vi.mock('../src/lib/supabase', () => ({ supabase: null }))
import { EntryPage } from '../src/pages/EntryPage'
import { AuthCallbackPage } from '../src/pages/AuthCallbackPage'

Object.defineProperty(globalThis, 'AbortController', { configurable: true, value: transferableAbortController().constructor })
function open(path: string) {
  const router = createMemoryRouter([
    { path: '/entrar', element: <EntryPage /> },
    { path: '/auth/callback', element: <AuthCallbackPage /> },
    { path: '*', element: <p>Destino</p> },
  ], { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); mocks.identity.mockResolvedValue({ ok: true, value: null }) })
afterEach(cleanup)

describe('entrada conectada com Google', () => {
  it('guarda a formação antes do OAuth e bloqueia cliques simultâneos', async () => {
    const user = userEvent.setup()
    let complete: ((result: unknown) => void) | undefined
    mocks.login.mockReturnValue(new Promise(resolve => { complete = resolve }))
    open('/entrar?curso=clinical_analysis')
    await user.dblClick(screen.getByRole('button', { name: /^Entrar com Google — aluno/ }))
    expect(mocks.login).toHaveBeenCalledTimes(1)
    expect(mocks.login).toHaveBeenCalledWith('student')
    expect(sessionStorage.getItem('osler.login.course')).toBe('clinical_analysis')
    complete?.({ ok: false, message: 'Tente novamente.' })
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Entrar com Google — aluno/ }).hasAttribute('disabled')).toBe(false)
  })

  it('retoma a formação após o Google no painel, aguardando a escolha do aluno', async () => {
    mocks.identity.mockResolvedValue({ ok: true, value: { role: 'student' } })
    mocks.course.mockResolvedValue({ ok: true, course: 'clinical_analysis' })
    sessionStorage.setItem('osler.login.course', 'clinical_analysis')
    const router = open('/auth/callback')
    await waitFor(() => expect(router.state.location.pathname).toBe('/curso'))
    expect(router.state.location.search).toBe('?curso=clinical_analysis')
    expect(mocks.course).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('osler.login.course')).toBeNull()
  })

  it('respeita o papel retornado pelo servidor ao voltar do Google', async () => {
    mocks.identity.mockResolvedValue({ ok: true, value: { role: 'student' } })
    sessionStorage.setItem('osler.login.destination', 'teacher')
    const router = open('/auth/callback')
    await waitFor(() => expect(router.state.location.pathname).toBe('/curso'))
    expect(mocks.course).not.toHaveBeenCalled()
  })
})
