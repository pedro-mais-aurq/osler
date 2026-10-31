// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getSession: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    auth: {
      getSession: mocks.getSession,
      signInWithOAuth: mocks.signInWithOAuth,
      signOut: mocks.signOut,
    },
  },
}))
vi.mock('../src/lib/dataMode', () => ({ isLocalMode: false }))
import {
  getPortalIdentity,
  getTeacherDebrief,
  signInWithGoogle,
} from '../src/services/teaching'
beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})
describe('contrato de autenticação e debrief docente', () => {
  it('pede Google com retorno à base da aplicação, sem credenciais privadas', async () => {
    mocks.signInWithOAuth.mockResolvedValue({ error: null })
    expect((await signInWithGoogle('teacher')).ok).toBe(true)
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: new URL(`${import.meta.env.BASE_URL}auth/callback`, window.location.origin).href,
        scopes: 'email profile',
        queryParams: { prompt: 'select_account' },
      },
    })
    expect(sessionStorage.getItem('osler.login.destination')).toBe('teacher')
  })
  it('consulta o papel no servidor e não usa metadados editáveis', async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user',
            is_anonymous: false,
            user_metadata: { role: 'teacher' },
          },
        },
      },
      error: null,
    })
    const identity = {
      userId: 'user',
      email: 'aluno@example.com',
      displayName: 'Aluno',
      role: 'student',
    }
    mocks.rpc.mockResolvedValue({ data: identity, error: null })
    expect(await getPortalIdentity()).toEqual({ ok: true, value: identity })
    expect(mocks.rpc).toHaveBeenCalledWith('teaching_bootstrap', {})
  })
  it('mostra erro recuperável se o provedor não iniciar', async () => {
    mocks.signInWithOAuth.mockRejectedValue(new Error('Network error'))
    expect((await signInWithGoogle('student')).ok).toBe(false)
  })
  it('normaliza o snapshot remoto com o mesmo parser do aluno', async () => {
    const id = '50000000-0000-4000-8000-000000000001'
    const raw = {
      schema_version: 1,
      session: {
        id,
        status: 'completed',
        score_total: 0,
        decision_count: 0,
        started_at: '2026-10-30T10:00:00.000Z',
        completed_at: '2026-10-30T10:01:00.000Z',
      },
      case: {
        id: '20000000-0000-4000-8000-000000000001',
        title: 'Caso',
        educational_objective: 'Objetivo',
      },
      decisions: [],
      references: [],
    }
    mocks.rpc.mockResolvedValue({
      data: { debrief: raw, email: 'aluno@example.com', feedback: 'Olá' },
      error: null,
    })
    const result = await getTeacherDebrief(id)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.debrief.sessionId).toBe(id)
    mocks.rpc.mockResolvedValue({
      data: {
        debrief: { ...raw, truth_model: { secret: true } },
        email: 'aluno@example.com',
        feedback: '',
      },
      error: null,
    })
    expect((await getTeacherDebrief(id)).ok).toBe(false)
  })
})
