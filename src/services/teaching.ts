import { supabase } from '../lib/supabase'
import { isLocalMode } from '../lib/dataMode'
import { parseSimulationDebrief } from '../features/debrief/parsers'
import * as local from '../features/teaching/localStore'
import type {
  Assignment,
  CaseDraft,
  Classroom,
  PortalIdentity,
  PublicPracticeWorkspace,
  ServiceResult,
  StudentWorkspace,
  TeacherWorkspace,
} from '../features/teaching/types'

async function run<T>(
  localAction: () => T,
  name: string,
  params: Record<string, unknown> = {},
): Promise<ServiceResult<T>> {
  try {
    if (isLocalMode) return { ok: true, value: localAction() }
    if (!supabase)
      return {
        ok: false,
        message:
          'A conexão ainda não está configurada. Use a demonstração local ou configure o Supabase.',
      }
    const { data, error } = await supabase.rpc(name, params)
    if (error)
      return {
        ok: false,
        message:
          error.code === '42501'
            ? 'Esta conta não tem acesso a este recurso. Verifique seu e-mail e a permissão de professor.'
            : ['22023', 'P0001'].includes(error.code ?? '')
              ? error.message
              : ['23514', '23502', '22P02'].includes(error.code ?? '')
                ? 'Revise os campos e o recurso selecionado antes de tentar novamente.'
                : 'Não foi possível concluir a operação. Tente novamente.',
      }
    return { ok: true, value: data as T }
  } catch (error) {
    return {
      ok: false,
      message:
        isLocalMode && error instanceof Error
          ? error.message
          : 'Não foi possível concluir a operação. Tente novamente.',
    }
  }
}

export async function getPortalIdentity(selectedRole?: 'student' | 'teacher'): Promise<
  ServiceResult<PortalIdentity | null>
> {
  if (isLocalMode) {
    try {
      return { ok: true, value: selectedRole ? local.loginLocal(local.localIdentity()!.email, selectedRole) : local.localIdentity() }
    } catch {
      return {
        ok: false,
        message:
          'O armazenamento local está indisponível. Habilite o armazenamento do navegador.',
      }
    }
  }
  if (!supabase) return { ok: true, value: null }
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error)
      return {
        ok: false,
        message: 'Não foi possível verificar a sessão. Tente novamente.',
      }
    if (!data.session || data.session.user.is_anonymous)
      return { ok: true, value: null }
    return selectedRole ? run(() => null, 'select_portal_role', { p_role: selectedRole }) : run(() => null, 'teaching_bootstrap')
  } catch {
    return { ok: false, message: 'Não foi possível verificar sua sessão.' }
  }
}

export async function signInWithGoogle(
  destination: 'teacher' | 'student',
): Promise<ServiceResult<null>> {
  if (isLocalMode)
    return {
      ok: false,
      message: 'Na demonstração, escolha uma conta local abaixo.',
    }
  if (!supabase)
    return {
      ok: false,
      message:
        'Configure o provedor Google e as variáveis do Supabase antes de entrar online. Para testar agora, execute npm run dev:local.',
    }
  try {
    sessionStorage.setItem('osler.login.destination', destination)
    const redirectTo = new URL(
      `${import.meta.env.BASE_URL}auth/callback`,
      window.location.origin,
    ).href
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        scopes: 'email profile',
        queryParams: { prompt: 'select_account' },
      },
    })
    return error
      ? {
          ok: false,
          message:
            'Não foi possível iniciar o login com Google. Tente novamente.',
        }
      : { ok: true, value: null }
  } catch {
    return { ok: false, message: 'Não foi possível abrir o login com Google.' }
  }
}
export async function signOutPortal(): Promise<ServiceResult<null>> {
  try {
    if (isLocalMode) local.logoutLocal()
    else if (supabase) {
      const { error } = await supabase.auth.signOut()
      if (error)
        return {
          ok: false,
          message: 'Não foi possível sair da conta. Tente novamente.',
        }
    }
    window.dispatchEvent(new Event(local.portalChangeEvent))
    return { ok: true, value: null }
  } catch {
    return { ok: false, message: 'Não foi possível sair da conta.' }
  }
}
export const getTeacherWorkspace = () =>
  run(local.localTeacherWorkspace, 'teaching_workspace')
export const getStudentWorkspace = () =>
  run(local.localStudentWorkspace, 'student_workspace')
export const getPublicPractice = (course: import('../types/database').StudentCourse) =>
  run<PublicPracticeWorkspace>(() => local.localPublicPractice(course), 'public_case_catalogue', { p_course: course })
export const joinClassroom = (code: string) =>
  run(() => local.localJoinClassroom(code), 'student_join_classroom', { p_code: code })
export const saveClassroom = (
  input: Pick<Classroom, 'name' | 'course' | 'description' | 'term'>,
  id?: string,
) =>
  run(() => local.localSaveClassroom(input, id), 'teaching_save_classroom', {
    p_input: input,
    p_id: id ?? null,
  })
export const archiveClassroom = (id: string, archived: boolean) =>
  run(
    () => local.localArchiveClassroom(id, archived),
    'teaching_archive_classroom',
    { p_id: id, p_archived: archived },
  )
export const enrollStudents = (classroomId: string, emails: string[]) =>
  run(() => local.localEnroll(classroomId, emails), 'teaching_enroll', {
    p_classroom_id: classroomId,
    p_emails: emails,
  })
export const revokeEnrollment = (id: string) =>
  run(() => local.localRevoke(id), 'teaching_revoke_enrollment', { p_id: id })
export const saveTeachingCase = (
  draft: CaseDraft,
  id?: string,
  publish = false,
) =>
  run(() => local.localSaveCase(draft, id, publish), 'teaching_save_case', {
    p_draft: draft,
    p_id: id ?? null,
    p_publish: publish,
  })
export const archiveTeachingCase = (id: string) =>
  run(() => local.localArchiveCase(id), 'teaching_archive_case', { p_id: id })
export const assignCase = (
  classroomId: string,
  caseId: string,
  title: string,
  dueAt: string | null,
) =>
  run(
    () => local.localAssign(classroomId, caseId, title, dueAt),
    'teaching_assign_case',
    {
      p_classroom_id: classroomId,
      p_case_id: caseId,
      p_title: title,
      p_due_at: dueAt,
    },
  )
export const setAssignmentStatus = (id: string, status: Assignment['status']) =>
  run(
    () => local.localCloseAssignment(id, status),
    'teaching_set_assignment_status',
    { p_id: id, p_status: status },
  )
export async function getTeacherDebrief(sessionId: string) {
  const result = await run(
    () => local.localTeacherDebrief(sessionId),
    'teaching_get_debrief',
    { p_session_id: sessionId },
  )
  if (!result.ok || isLocalMode) return result
  const debrief = parseSimulationDebrief(result.value?.debrief)
  if (
    !debrief ||
    debrief.sessionId !== sessionId ||
    typeof result.value.email !== 'string' ||
    typeof result.value.feedback !== 'string'
  )
    return {
      ok: false as const,
      message: 'O debriefing retornou um formato inesperado.',
    }
  return { ok: true as const, value: { ...result.value, debrief } }
}
export const saveTeacherFeedback = (sessionId: string, feedback: string) =>
  run(
    () => local.localSaveFeedback(sessionId, feedback),
    'teaching_save_feedback',
    { p_session_id: sessionId, p_feedback: feedback },
  )

// Compile-time parity for both adapters.
export type { TeacherWorkspace, StudentWorkspace }

export async function saveTeachingSubject(subject: string) {
  const result = await run(() => local.localSetTeachingSubject(subject), 'teaching_set_subject', { p_subject: subject })
  if (result.ok) window.dispatchEvent(new Event(local.portalChangeEvent))
  return result
}
