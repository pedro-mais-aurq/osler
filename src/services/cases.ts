import {
  parseCaseStep,
  parseCaseSummary,
  parsePatient,
  unsupportedStepMessage,
} from '../features/simulation/parsers'
import type {
  CaseStep,
  SimulationCase,
  SimulationCaseSummary,
} from '../features/simulation/types'
import { supabase, supabaseConfigurationError } from '../lib/supabase'
import type { StudentCourse } from '../types/database'

export type CaseLookupResult =
  | { ok: true; case: SimulationCaseSummary | null }
  | { ok: false; message: string; cause?: unknown }

export type CaseResolutionResult =
  | {
      ok: true
      case: SimulationCaseSummary | null
      requestedCaseAccepted: boolean
    }
  | { ok: false; message: string; cause?: unknown }

export type SimulationCaseResult =
  | { ok: true; simulationCase: SimulationCase }
  | { ok: false; message: string; cause?: unknown }

export type VisibleCaseStepResult =
  | { ok: true; step: CaseStep }
  | { ok: false; message: string; cause?: unknown }

const handoffColumns =
  'id, slug, title, course, description, educational_objective, status'
const stepColumns =
  'id, case_id, position, step_key, step_type, title, content, options, metadata'

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function unavailableResult(cause?: unknown): CaseLookupResult {
  return {
    ok: false,
    message: 'Não foi possível consultar os casos agora. Tente novamente.',
    cause,
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

  if (!data) {
    return { ok: true, case: null }
  }

  const clinicalCase = parseCaseSummary(data, course)

  return clinicalCase
    ? { ok: true, case: clinicalCase }
    : unavailableResult(data)
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

  if (!data) {
    return { ok: true, case: null }
  }

  const clinicalCase = parseCaseSummary(data, course)

  return clinicalCase
    ? { ok: true, case: clinicalCase }
    : unavailableResult(data)
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
      cause: caseError ?? caseData,
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
      .select(stepColumns)
      .eq('case_id', caseId)
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const clinicalCase = parseCaseSummary(caseData, course)
  const patient = parsePatient(patientResult.data)
  const parsedStep = parseCaseStep(firstStepResult.data)

  if (!parsedStep.ok && parsedStep.kind === 'unsupported_step') {
    return {
      ok: false,
      message: unsupportedStepMessage,
      cause: parsedStep.cause,
    }
  }

  if (
    patientResult.error ||
    firstStepResult.error ||
    !clinicalCase ||
    !patient ||
    !parsedStep.ok ||
    parsedStep.value.caseId !== caseId
  ) {
    return {
      ok: false,
      message: 'O conteúdo deste caso está incompleto. Tente outro caso mais tarde.',
      cause:
        patientResult.error ??
        firstStepResult.error ??
        (!parsedStep.ok ? parsedStep.cause : caseData),
    }
  }

  return {
    ok: true,
    simulationCase: {
      case: clinicalCase,
      patient,
      firstStep: parsedStep.value,
    },
  }
}

export async function getVisibleCaseStepByKey(
  caseId: string,
  stepKey: string,
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
    .select(stepColumns)
    .eq('case_id', caseId)
    .eq('step_key', stepKey)
    .maybeSingle()

  if (error || !data) {
    return {
      ok: false,
      message: 'Não foi possível carregar a próxima etapa. Tente novamente.',
      cause: error ?? data,
    }
  }

  const parsedStep = parseCaseStep(data)

  if (!parsedStep.ok) {
    return {
      ok: false,
      message:
        parsedStep.kind === 'unsupported_step'
          ? unsupportedStepMessage
          : 'A próxima etapa retornou um formato inesperado. Tente novamente.',
      cause: parsedStep.cause,
    }
  }

  if (parsedStep.value.caseId !== caseId || parsedStep.value.stepKey !== stepKey) {
    return {
      ok: false,
      message: 'A próxima etapa retornou um formato inesperado. Tente novamente.',
      cause: data,
    }
  }

  return { ok: true, step: parsedStep.value }
}
