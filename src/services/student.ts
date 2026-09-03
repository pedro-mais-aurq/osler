import { supabase, supabaseConfigurationError } from '../lib/supabase'
import type { AppRole, StudentCourse, StudentIdentity } from '../types/database'
import { getCurrentSession } from './auth'

type StudentFailureReason =
  | 'configuration'
  | 'not_authenticated'
  | 'incompatible_role'
  | 'student_not_found'
  | 'query_failed'

export type StudentResult =
  | { ok: true; student: StudentIdentity }
  | {
      ok: false
      reason: StudentFailureReason
      message: string
      cause?: unknown
    }

export type StudentCourseResult =
  | { ok: true; course: StudentCourse | null }
  | Exclude<StudentResult, { ok: true }>

const triggerRetryDelaysMs = [0, 120, 250] as const

function isAppRole(value: unknown): value is AppRole {
  return value === 'student' || value === 'teacher' || value === 'admin'
}

function isStudentCourse(value: unknown): value is StudentCourse {
  return value === 'nursing' || value === 'clinical_analysis'
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs))
}

export async function getCurrentStudent(): Promise<StudentResult> {
  if (!supabase) {
    return {
      ok: false,
      reason: 'configuration',
      message: 'A conexão com o OSLER ainda não está configurada.',
      cause: supabaseConfigurationError,
    }
  }

  const sessionResult = await getCurrentSession()

  if (!sessionResult.ok) {
    return {
      ok: false,
      reason: 'query_failed',
      message: sessionResult.message,
      cause: sessionResult.cause,
    }
  }

  if (!sessionResult.session) {
    return {
      ok: false,
      reason: 'not_authenticated',
      message: 'Inicie como aluno para continuar.',
    }
  }

  const userId = sessionResult.session.user.id

  for (const [attempt, delayMs] of triggerRetryDelaysMs.entries()) {
    if (delayMs > 0) {
      await wait(delayMs)
    }

    const [profileResult, studentResult] = await Promise.all([
      supabase.from('profiles').select('user_id, role').eq('user_id', userId).maybeSingle(),
      supabase.from('students').select('user_id, course').eq('user_id', userId).maybeSingle(),
    ])

    if (profileResult.error || studentResult.error) {
      return {
        ok: false,
        reason: 'query_failed',
        message: 'Não foi possível carregar seu perfil de estudante. Tente novamente.',
        cause: profileResult.error ?? studentResult.error,
      }
    }

    if (profileResult.data && studentResult.data) {
      const role = profileResult.data.role
      const course = studentResult.data.course

      if (!isAppRole(role)) {
        return {
          ok: false,
          reason: 'query_failed',
          message: 'O perfil retornou um papel inválido.',
        }
      }

      if (role !== 'student') {
        return {
          ok: false,
          reason: 'incompatible_role',
          message: 'Esta sessão não pertence a um estudante.',
        }
      }

      if (course !== null && !isStudentCourse(course)) {
        return {
          ok: false,
          reason: 'query_failed',
          message: 'O perfil retornou um curso inválido.',
        }
      }

      return {
        ok: true,
        student: { userId, role, course },
      }
    }

    if (attempt === triggerRetryDelaysMs.length - 1) {
      break
    }
  }

  return {
    ok: false,
    reason: 'student_not_found',
    message: 'Seu perfil de estudante ainda não está disponível. Tente novamente.',
  }
}

export async function getCurrentStudentCourse(): Promise<StudentCourseResult> {
  const result = await getCurrentStudent()

  if (!result.ok) {
    return result
  }

  return { ok: true, course: result.student.course }
}

export async function updateCurrentStudentCourse(
  course: StudentCourse,
): Promise<StudentCourseResult> {
  if (!supabase) {
    return {
      ok: false,
      reason: 'configuration',
      message: 'A conexão com o OSLER ainda não está configurada.',
      cause: supabaseConfigurationError,
    }
  }

  const currentStudent = await getCurrentStudent()

  if (!currentStudent.ok) {
    return currentStudent
  }

  const { data, error } = await supabase
    .from('students')
    .update({ course })
    .eq('user_id', currentStudent.student.userId)
    .select('course')
    .single()

  if (error || !data || !isStudentCourse(data.course)) {
    return {
      ok: false,
      reason: 'query_failed',
      message: 'Não foi possível salvar seu curso. Tente novamente.',
      cause: error,
    }
  }

  return { ok: true, course: data.course }
}
