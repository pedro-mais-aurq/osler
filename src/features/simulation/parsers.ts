import type {
  CaseStep,
  ClinicalPresentationState,
  LaboratoryStage,
  LaboratoryVisibleData,
  SimulationCaseSummary,
  SimulationPatient,
  SimulationTransition,
  StepClassification,
  StepOption,
} from './types'

export const unsupportedStepMessage = 'Este tipo de etapa ainda não é suportado.'

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; kind: 'invalid' | 'unsupported_step'; cause: unknown }

const statuses = new Set(['draft', 'published', 'archived'])
const classifications: ReadonlySet<StepClassification> = new Set([
  'ideal',
  'acceptable',
  'needs_improvement',
  'unsafe',
])
const presentationStates: ReadonlySet<ClinicalPresentationState> = new Set([
  'stable',
  'warning',
  'critical',
  'recovery',
])
const laboratoryStages: ReadonlySet<LaboratoryStage> = new Set([
  'request',
  'sample',
  'preanalytical',
  'analysis',
  'result',
])
const laboratoryKeys = new Set(['stage', 'title', 'fields', 'notes'])
const laboratoryFieldKeys = new Set(['label', 'value'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseObservations(value: unknown): string[] | null {
  if (value === undefined) {
    return []
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return null
  }

  return value
}

function parseOptions(value: unknown): StepOption[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const options: StepOption[] = []

  for (const option of value) {
    if (
      !isRecord(option) ||
      typeof option.id !== 'string' ||
      option.id.trim() === '' ||
      typeof option.label !== 'string' ||
      option.label.trim() === ''
    ) {
      return null
    }

    options.push({ id: option.id, label: option.label })
  }

  return options
}

export function parseLaboratoryVisibleData(
  value: unknown,
): LaboratoryVisibleData | null {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !laboratoryKeys.has(key)) ||
    typeof value.stage !== 'string' ||
    !laboratoryStages.has(value.stage as LaboratoryStage) ||
    typeof value.title !== 'string' ||
    value.title.trim() === '' ||
    !Array.isArray(value.fields) ||
    value.fields.length === 0
  ) {
    return null
  }

  const fields = []

  for (const field of value.fields) {
    if (
      !isRecord(field) ||
      Object.keys(field).some((key) => !laboratoryFieldKeys.has(key)) ||
      typeof field.label !== 'string' ||
      field.label.trim() === '' ||
      typeof field.value !== 'string' ||
      field.value.trim() === ''
    ) {
      return null
    }

    fields.push({ label: field.label, value: field.value })
  }

  if (
    value.notes !== undefined &&
    (!Array.isArray(value.notes) ||
      value.notes.some(
        (note) => typeof note !== 'string' || note.trim() === '',
      ))
  ) {
    return null
  }

  return {
    stage: value.stage as LaboratoryStage,
    title: value.title,
    fields,
    ...(value.notes ? { notes: value.notes } : {}),
  }
}

export function parsePresentationState(
  value: unknown,
  fallback: ClinicalPresentationState = 'stable',
): ClinicalPresentationState | null {
  if (value === undefined || value === null) {
    return fallback
  }

  return typeof value === 'string' &&
    presentationStates.has(value as ClinicalPresentationState)
    ? (value as ClinicalPresentationState)
    : null
}

export function parseCaseSummary(
  data: unknown,
  expectedCourse: string,
): SimulationCaseSummary | null {
  if (!isRecord(data)) {
    return null
  }

  if (
    typeof data.id !== 'string' ||
    typeof data.slug !== 'string' ||
    typeof data.title !== 'string' ||
    data.course !== expectedCourse ||
    typeof data.description !== 'string' ||
    (data.educational_objective !== null &&
      typeof data.educational_objective !== 'string') ||
    typeof data.status !== 'string' ||
    !statuses.has(data.status)
  ) {
    return null
  }

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    description: data.description,
    educationalObjective: data.educational_objective,
    status: data.status as SimulationCaseSummary['status'],
  }
}

export function parsePatient(data: unknown): SimulationPatient | null {
  if (!isRecord(data)) {
    return null
  }

  if (
    typeof data.id !== 'string' ||
    typeof data.display_name !== 'string' ||
    (data.age_years !== null && typeof data.age_years !== 'number') ||
    (data.sex_or_anatomy_context !== null &&
      typeof data.sex_or_anatomy_context !== 'string') ||
    (data.pronouns !== null && typeof data.pronouns !== 'string') ||
    (data.visual_ref !== null && typeof data.visual_ref !== 'string')
  ) {
    return null
  }

  return {
    id: data.id,
    displayName: data.display_name,
    ageYears: data.age_years,
    sexOrAnatomyContext: data.sex_or_anatomy_context,
    pronouns: data.pronouns,
    visualRef: data.visual_ref,
  }
}

export function parseCaseStep(data: unknown): ParseResult<CaseStep> {
  if (!isRecord(data)) {
    return { ok: false, kind: 'invalid', cause: data }
  }

  if (data.step_type !== 'information' && data.step_type !== 'decision') {
    return { ok: false, kind: 'unsupported_step', cause: data.step_type }
  }

  const content = data.content
  const metadata = data.metadata
  const options = parseOptions(data.options)

  if (
    typeof data.id !== 'string' ||
    typeof data.case_id !== 'string' ||
    typeof data.position !== 'number' ||
    !Number.isInteger(data.position) ||
    data.position <= 0 ||
    typeof data.step_key !== 'string' ||
    data.step_key.trim() === '' ||
    (data.title !== null && typeof data.title !== 'string') ||
    !isRecord(content) ||
    typeof content.body !== 'string' ||
    !isRecord(metadata) ||
    !options
  ) {
    return { ok: false, kind: 'invalid', cause: data }
  }

  const observations = parseObservations(content.observations)
  const laboratory =
    content.laboratory === undefined
      ? undefined
      : parseLaboratoryVisibleData(content.laboratory)
  const presentationState = parsePresentationState(metadata.presentation_state)

  if (
    !observations ||
    !presentationState ||
    (content.laboratory !== undefined && !laboratory)
  ) {
    return { ok: false, kind: 'invalid', cause: data }
  }

  const base = {
    id: data.id,
    caseId: data.case_id,
    position: data.position,
    stepKey: data.step_key,
    title: data.title,
    content: {
      body: content.body,
      observations,
      ...(laboratory ? { laboratory } : {}),
    },
    presentationState,
  }

  if (data.step_type === 'information') {
    if (options.length !== 0) {
      return { ok: false, kind: 'invalid', cause: data }
    }

    return { ok: true, value: { ...base, type: 'information' } }
  }

  if (options.length === 0) {
    return { ok: false, kind: 'invalid', cause: data }
  }

  return { ok: true, value: { ...base, type: 'decision', options } }
}

export function parseSimulationTransition(data: unknown): SimulationTransition | null {
  const candidate = Array.isArray(data) ? data[0] : data

  if (!isRecord(candidate)) {
    return null
  }

  const {
    classification,
    score_delta: scoreDelta,
    feedback,
    consequence,
    next_step_key: nextStepKey,
    completed,
    presentation_state: rawPresentationState,
  } = candidate

  if (
    typeof scoreDelta !== 'number' ||
    !Number.isInteger(scoreDelta) ||
    typeof completed !== 'boolean' ||
    (nextStepKey !== null &&
      (typeof nextStepKey !== 'string' || nextStepKey.trim() === '')) ||
    (completed ? nextStepKey !== null : nextStepKey === null)
  ) {
    return null
  }

  const presentationState =
    rawPresentationState === null
      ? null
      : typeof rawPresentationState === 'string'
        ? parsePresentationState(rawPresentationState)
        : null

  if (rawPresentationState !== null && !presentationState) {
    return null
  }

  if (classification === null) {
    if (scoreDelta !== 0 || feedback !== null || consequence !== null) {
      return null
    }

    return {
      evaluation: null,
      nextStepKey,
      completed,
      presentationState,
    }
  }

  if (
    typeof classification !== 'string' ||
    !classifications.has(classification as StepClassification) ||
    typeof feedback !== 'string' ||
    feedback.trim() === '' ||
    (consequence !== null && typeof consequence !== 'string')
  ) {
    return null
  }

  return {
    evaluation: {
      classification: classification as StepClassification,
      scoreDelta,
      feedback,
      consequence,
    },
    nextStepKey,
    completed,
    presentationState,
  }
}
