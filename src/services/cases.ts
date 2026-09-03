import { supabase, supabaseConfigurationError } from '../lib/supabase'
import type { ClinicalCaseHandoff, StudentCourse } from '../types/database'

export type CaseLookupResult =
  | { ok: true; case: ClinicalCaseHandoff | null }
  | { ok: false; message: string; cause?: unknown }

export type CaseResolutionResult =
  | {
      ok: true
      case: ClinicalCaseHandoff | null
      requestedCaseAccepted: boolean
    }
  | { ok: false; message: string; cause?: unknown }

const handoffColumns =
  'id, slug, title, course, description, educational_objective, status'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function unavailableResult(cause?: unknown): CaseLookupResult {
  return {
    ok: false,
    message: 'Não foi possível consultar os casos agora. Tente novamente.',
    cause,
  }
}

function normalizeCase(data: unknown): ClinicalCaseHandoff | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  return data as ClinicalCaseHandoff
}

async function getPublishedCaseByIdForCourse(
  caseId: string,
  course: StudentCourse,
): Promise<CaseLookupResult> {
  if (!supabase) {
    return unavailableResult(supabaseConfigurationError)
  }

  const { data, error } = await supabase
    .from('clinical_cases')
    .select(handoffColumns)
    .eq('id', caseId)
    .eq('status', 'published')
    .eq('course', course)
    .maybeSingle()

  if (error) {
    return unavailableResult(error)
  }

  return { ok: true, case: normalizeCase(data) }
}

export async function getFirstPublishedCaseForCourse(
  course: StudentCourse,
): Promise<CaseLookupResult> {
  if (!supabase) {
    return unavailableResult(supabaseConfigurationError)
  }

  const { data, error } = await supabase
    .from('clinical_cases')
    .select(handoffColumns)
    .eq('status', 'published')
    .eq('course', course)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    return unavailableResult(error)
  }

  return { ok: true, case: normalizeCase(data) }
}

export async function resolvePublishedCaseForCourse(
  course: StudentCourse,
  requestedCaseId: string | null,
): Promise<CaseResolutionResult> {
  if (requestedCaseId && uuidPattern.test(requestedCaseId)) {
    const requestedCase = await getPublishedCaseByIdForCourse(requestedCaseId, course)

    if (!requestedCase.ok) {
      return requestedCase
    }

    if (requestedCase.case) {
      return {
        ok: true,
        case: requestedCase.case,
        requestedCaseAccepted: true,
      }
    }
  }

  const firstCase = await getFirstPublishedCaseForCourse(course)

  if (!firstCase.ok) {
    return firstCase
  }

  return {
    ok: true,
    case: firstCase.case,
    requestedCaseAccepted: false,
  }
}
