import type { StepClassification } from '../simulation/types'
import { createDebriefSummary } from './summary'
import type {
  DebriefDecision,
  DebriefReference,
  SimulationDebrief,
} from './types'

const classifications: ReadonlySet<StepClassification> = new Set([
  'ideal',
  'acceptable',
  'needs_improvement',
  'unsafe',
])
const rootKeys = new Set([
  'schema_version',
  'session',
  'case',
  'decisions',
  'references',
])
const sessionKeys = new Set([
  'id',
  'status',
  'score_total',
  'decision_count',
  'started_at',
  'completed_at',
])
const caseKeys = new Set(['id', 'title', 'educational_objective'])
const decisionKeys = new Set([
  'action_id',
  'step_id',
  'step_key',
  'step_title',
  'position',
  'selected_option_id',
  'selected_option_label',
  'classification',
  'score_delta',
  'feedback',
  'consequence',
  'created_at',
])
const referenceKeys = new Set([
  'id',
  'authority',
  'title',
  'year',
  'url',
  'verified_on',
])
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key))
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function isNullableNonEmptyString(value: unknown): value is string | null {
  return value === null || isNonEmptyString(value)
}

function isTimestamp(value: unknown): value is string {
  return (
    isNonEmptyString(value) &&
    value.includes('T') &&
    Number.isFinite(Date.parse(value))
  )
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
}

function isHttpUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false
  }

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function isValidDebriefSessionId(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value)
}

function parseDecision(value: unknown): DebriefDecision | null {
  if (!isRecord(value) || !hasOnlyKeys(value, decisionKeys)) {
    return null
  }

  if (
    !isValidDebriefSessionId(value.action_id) ||
    !isValidDebriefSessionId(value.step_id) ||
    !isNonEmptyString(value.step_key) ||
    !isNullableNonEmptyString(value.step_title) ||
    !Number.isInteger(value.position) ||
    (value.position as number) < 1 ||
    !isNonEmptyString(value.selected_option_id) ||
    !isNonEmptyString(value.selected_option_label) ||
    typeof value.classification !== 'string' ||
    !classifications.has(value.classification as StepClassification) ||
    !Number.isInteger(value.score_delta) ||
    !isNonEmptyString(value.feedback) ||
    !isNullableNonEmptyString(value.consequence) ||
    !isTimestamp(value.created_at)
  ) {
    return null
  }

  return {
    actionId: value.action_id,
    stepId: value.step_id,
    stepKey: value.step_key,
    stepTitle: value.step_title,
    position: value.position as number,
    selectedOptionId: value.selected_option_id,
    selectedOptionLabel: value.selected_option_label,
    classification: value.classification as StepClassification,
    scoreDelta: value.score_delta as number,
    feedback: value.feedback,
    consequence: value.consequence,
    createdAt: value.created_at,
  }
}

function parseReference(value: unknown): DebriefReference | null {
  if (!isRecord(value) || !hasOnlyKeys(value, referenceKeys)) {
    return null
  }

  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.authority) ||
    !isNonEmptyString(value.title) ||
    (value.year !== undefined &&
      (!Number.isInteger(value.year) ||
        (value.year as number) < 1000 ||
        (value.year as number) > 9999)) ||
    (value.url !== undefined && !isHttpUrl(value.url)) ||
    (value.verified_on !== undefined && !isDateOnly(value.verified_on))
  ) {
    return null
  }

  return {
    id: value.id,
    authority: value.authority,
    title: value.title,
    year: (value.year as number | undefined) ?? null,
    url: (value.url as string | undefined) ?? null,
    verifiedOn: (value.verified_on as string | undefined) ?? null,
  }
}

function isStableTrajectoryOrder(decisions: DebriefDecision[]): boolean {
  return decisions.every((decision, index) => {
    const previous = decisions[index - 1]

    if (!previous) {
      return true
    }

    const timeDifference =
      Date.parse(decision.createdAt) - Date.parse(previous.createdAt)

    return (
      timeDifference > 0 ||
      (timeDifference === 0 && decision.actionId.localeCompare(previous.actionId) >= 0)
    )
  })
}

export function parseSimulationDebrief(value: unknown): SimulationDebrief | null {
  if (!isRecord(value) || !hasOnlyKeys(value, rootKeys)) {
    return null
  }

  const session = value.session
  const caseData = value.case

  if (
    value.schema_version !== 1 ||
    !isRecord(session) ||
    !hasOnlyKeys(session, sessionKeys) ||
    !isRecord(caseData) ||
    !hasOnlyKeys(caseData, caseKeys) ||
    !Array.isArray(value.decisions) ||
    !Array.isArray(value.references) ||
    !isValidDebriefSessionId(session.id) ||
    session.status !== 'completed' ||
    !Number.isInteger(session.score_total) ||
    !Number.isInteger(session.decision_count) ||
    (session.decision_count as number) < 0 ||
    !isTimestamp(session.started_at) ||
    !isTimestamp(session.completed_at) ||
    Date.parse(session.completed_at) < Date.parse(session.started_at) ||
    !isValidDebriefSessionId(caseData.id) ||
    !isNonEmptyString(caseData.title) ||
    !isNullableNonEmptyString(caseData.educational_objective)
  ) {
    return null
  }

  const decisions = value.decisions.map(parseDecision)
  const references = value.references.map(parseReference)

  if (
    decisions.some((decision) => decision === null) ||
    references.some((reference) => reference === null)
  ) {
    return null
  }

  const parsedDecisions = decisions as DebriefDecision[]
  const parsedReferences = references as DebriefReference[]

  if (
    parsedDecisions.length !== session.decision_count ||
    new Set(parsedDecisions.map((decision) => decision.actionId)).size !==
      parsedDecisions.length ||
    new Set(parsedReferences.map((reference) => reference.id)).size !==
      parsedReferences.length ||
    !isStableTrajectoryOrder(parsedDecisions)
  ) {
    return null
  }

  return {
    sessionId: session.id,
    caseId: caseData.id,
    caseTitle: caseData.title,
    educationalObjective: caseData.educational_objective,
    startedAt: session.started_at,
    completedAt: session.completed_at,
    summary: createDebriefSummary(session.score_total as number, parsedDecisions),
    decisions: parsedDecisions,
    references: parsedReferences,
  }
}
