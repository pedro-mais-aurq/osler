import { supabase, supabaseConfigurationError } from '../lib/supabase'
import type {
  ClinicalCaseHandoff,
  SimulationCase,
  SimulationPatient,
  StudentCourse,
  VisibleCaseStep,
  VisibleStepOption,
} from '../types/database'

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

export type SimulationCaseResult =
  | { ok: true; simulationCase: SimulationCase }
  | { ok: false; message: string; cause?: unknown }

export type VisibleCaseStepResult =
  | { ok: true; step: VisibleCaseStep | null }
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

function normalizePatient(data: unknown): SimulationPatient | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  const row = data as Record<string, unknown>

  if (typeof row.id !== 'string' || typeof row.display_name !== 'string') {
    return null
  }

  return {
    id: row.id,
    display_name: row.display_name,
    age_years: typeof row.age_years === 'number' ? row.age_years : null,
    sex_or_anatomy_context:
      typeof row.sex_or_anatomy_context === 'string'
        ? row.sex_or_anatomy_context
        : null,
    pronouns: typeof row.pronouns === 'string' ? row.pronouns : null,
  }
}

function normalizeOptions(data: unknown): VisibleStepOption[] | null {
  if (!Array.isArray(data)) {
    return null
  }

  const options: VisibleStepOption[] = []

  for (const option of data) {
    if (!option || typeof option !== 'object') {
      return null
    }

    const row = option as Record<string, unknown>

    if (typeof row.id !== 'string' || typeof row.label !== 'string') {
      return null
    }

    options.push({ id: row.id, label: row.label })
  }

  return options
}

function normalizeStep(data: unknown): VisibleCaseStep | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  const row = data as Record<string, unknown>
  const rawContent = row.content
  const options = normalizeOptions(row.options)

  if (
    typeof row.id !== 'string' ||
    typeof row.case_id !== 'string' ||
    typeof row.position !== 'number' ||
    typeof row.step_key !== 'string' ||
    (row.step_type !== 'information' && row.step_type !== 'decision') ||
    (row.title !== null && typeof row.title !== 'string') ||
    !rawContent ||
    typeof rawContent !== 'object' ||
    !options
  ) {
    return null
  }

  const content = rawContent as Record<string, unknown>

  if (typeof content.body !== 'string') {
    return null
  }

  const observations = Array.isArray(content.observations)
    ? content.observations.filter(
        (observation): observation is string => typeof observation === 'string',
      )
    : []

  if (row.step_type === 'decision' && options.length === 0) {
    return null
  }

  return {
    id: row.id,
    case_id: row.case_id,
    position: row.position,
    step_key: row.step_key,
    step_type: row.step_type,
    title: row.title,
    content: { body: content.body, observations },
    options,
  }
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

export async function getSimulationCase(
  caseId: string,
  course: StudentCourse,
): Promise<SimulationCaseResult> {
  if (!supabase) {
    return {
      ok: false,
      message: 'Não foi possível carregar a simulação agora. Tente novamente.',
      cause: supabaseConfigurationError,
    }
  }

  const { data: caseData, error: caseError } = await supabase
    .from('clinical_cases')
    .select(`${handoffColumns}, patient_id`)
    .eq('id', caseId)
    .eq('status', 'published')
    .eq('course', course)
    .maybeSingle()

  if (caseError || !caseData || typeof caseData.patient_id !== 'string') {
    return {
      ok: false,
      message: 'Não foi possível carregar o caso publicado. Tente novamente.',
      cause: caseError,
    }
  }

  const [patientResult, firstStepResult] = await Promise.all([
    supabase
      .from('patients')
      .select('id, display_name, age_years, sex_or_anatomy_context, pronouns')
      .eq('id', caseData.patient_id)
      .maybeSingle(),
    supabase
      .from('case_steps')
      .select('id, case_id, position, step_key, step_type, title, content, options')
      .eq('case_id', caseId)
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const clinicalCase = normalizeCase(caseData)
  const patient = normalizePatient(patientResult.data)
  const firstStep = normalizeStep(firstStepResult.data)

  if (
    patientResult.error ||
    firstStepResult.error ||
    !clinicalCase ||
    !patient ||
    !firstStep
  ) {
    return {
      ok: false,
      message: 'O conteúdo deste caso está incompleto. Tente outro caso mais tarde.',
      cause: patientResult.error ?? firstStepResult.error,
    }
  }

  return {
    ok: true,
    simulationCase: {
      case: clinicalCase,
      patient,
      steps: [firstStep],
    },
  }
}

export async function getNextVisibleCaseStep(
  caseId: string,
  currentPosition: number,
): Promise<VisibleCaseStepResult> {
  if (!supabase) {
    return {
      ok: false,
      message: 'Não foi possível carregar a próxima etapa. Tente novamente.',
      cause: supabaseConfigurationError,
    }
  }

  const { data, error } = await supabase
    .from('case_steps')
    .select('id, case_id, position, step_key, step_type, title, content, options')
    .eq('case_id', caseId)
    .gt('position', currentPosition)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    return {
      ok: false,
      message: 'Não foi possível carregar a próxima etapa. Tente novamente.',
      cause: error,
    }
  }

  if (!data) {
    return { ok: true, step: null }
  }

  const step = normalizeStep(data)

  if (!step || step.case_id !== caseId || step.position <= currentPosition) {
    return {
      ok: false,
      message: 'A próxima etapa retornou um formato inesperado. Tente novamente.',
      cause: data,
    }
  }

  return { ok: true, step }
}
