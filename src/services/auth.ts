import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigurationError } from '../lib/supabase'

export type CurrentSessionResult =
  | { ok: true; session: Session | null }
  | { ok: false; message: string; cause?: unknown }

export type AuthResult =
  | {
      ok: true
      session: Session
      user: User
      created: boolean
    }
  | { ok: false; message: string; cause?: unknown }

let pendingAnonymousSession: Promise<AuthResult> | null = null

export async function getCurrentSession(): Promise<CurrentSessionResult> {
  if (!supabase) {
    return {
      ok: false,
      message: 'A conexão com o OSLER ainda não está configurada.',
      cause: supabaseConfigurationError,
    }
  }

  const { data, error } = await supabase.auth.getSession()

  if (error) {
    return {
      ok: false,
      message: 'Não foi possível verificar sua sessão. Tente novamente.',
      cause: error,
    }
  }

  return { ok: true, session: data.session }
}

async function createOrReuseAnonymousSession(): Promise<AuthResult> {
  const currentSession = await getCurrentSession()

  if (!currentSession.ok) {
    return currentSession
  }

  if (currentSession.session) {
    return {
      ok: true,
      session: currentSession.session,
      user: currentSession.session.user,
      created: false,
    }
  }

  if (!supabase) {
    return {
      ok: false,
      message: 'A conexão com o OSLER ainda não está configurada.',
      cause: supabaseConfigurationError,
    }
  }

  const { data, error } = await supabase.auth.signInAnonymously()

  if (error || !data.session || !data.user) {
    return {
      ok: false,
      message: 'Não foi possível iniciar sua sessão. Tente novamente.',
      cause: error,
    }
  }

  return {
    ok: true,
    session: data.session,
    user: data.user,
    created: true,
  }
}

export function ensureAnonymousStudentSession(): Promise<AuthResult> {
  if (pendingAnonymousSession) {
    return pendingAnonymousSession
  }

  pendingAnonymousSession = createOrReuseAnonymousSession().finally(() => {
    pendingAnonymousSession = null
  })

  return pendingAnonymousSession
}
