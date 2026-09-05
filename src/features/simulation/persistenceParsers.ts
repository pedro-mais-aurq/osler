import { parsePresentationState } from './parsers'
import type {
  AdvanceSimulationResult,
  RecordedSimulationDecision,
  SimulationSessionSnapshot,
  SimulationSessionStatus,
  SimulationTransition,
  StepClassification,
  StepEvaluation,
} from './types'

const classifications: ReadonlySet<StepClassification> = new Set([
  'ideal',
  'acceptable',
  'needs_improvement',
  'unsafe',
])
const sessionStatuses: ReadonlySet<SimulationSessionStatus> = new Set([
  'in_progress',
  'completed',
  'abandoned',
])
const sessionSnapshotKeys = new Set([
  'session_id',
  'case_id',
  'status',
  'current_step_id',
  'current_step_key',
  'score_total',
  'decision_count',
  'started_at',
  'resumed',
  'selected_option_id',
  'classification',
  'score_delta',
  'feedback',
  'consequence',
  'next_step_key',
  'transition_completed',
  'presentation_state',
])
const recordedDecisionKeys = new Set([
  'action_id',
  'session_id',
  'step_id',
  'selected_option_id',
  'classification',
  'score_delta',
  'feedback',
  'consequence',
  'next_step_key',
  'completed',
  'presentation_state',
  'score_total',
  'decision_count',
  'created_at',
  'replayed',
])
const advanceResultKeys = new Set([
  'session_id',
  'status',
  'current_step_id',
  'current_step_key',
  'score_total',
  'decision_count',
  'completed_at',
  'previous_step_id',
  'presentation_state',
  'replayed',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function firstRow(value: unknown): Record<string, unknown> | null {
  const row = Array.isArray(value) ? value[0] : value

  return isRecord(row) ? row : null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key))
}

function parseEvaluation(
  classification: unknown,
  scoreDelta: unknown,
  feedback: unknown,
  consequence: unknown,
): StepEvaluation | null {
  if (
    typeof classification !== 'string' ||
    !classifications.has(classification as StepClassification) ||
    !isInteger(scoreDelta) ||
    !isNonEmptyString(feedback) ||
    !isNullableString(consequence)
  ) {
    return null
  }

  return {
    classification: classification as StepClassification,
    scoreDelta,
    feedback,
    consequence,
  }
}

function parseTransition(
  row: Record<string, unknown>,
  completedKey: 'completed' | 'transition_completed',
): SimulationTransition | null {
  const evaluation = parseEvaluation(
    row.classification,
    row.score_delta,
    row.feedback,
    row.consequence,
  )
  const nextStepKey = row.next_step_key
  const completed = row[completedKey]
  const rawPresentationState = row.presentation_state

  if (
    !evaluation ||
    typeof completed !== 'boolean' ||
    !isNullableString(nextStepKey) ||
    !isNullableString(rawPresentationState) ||
    (nextStepKey !== null && nextStepKey.trim() === '') ||
    (completed ? nextStepKey !== null : nextStepKey === null)
  ) {
    return null
  }

  const presentationState =
    rawPresentationState === null
      ? null
      : parsePresentationState(rawPresentationState, 'stable')

  if (rawPresentationState !== null && !presentationState) {
    return null
  }

  return {
    evaluation,
    nextStepKey,
    completed,
    presentationState,
  }
}

export function parseSimulationSessionSnapshot(
  value: unknown,
): SimulationSessionSnapshot | null {
  const row = firstRow(value)

  if (
    !row ||
    !hasOnlyKeys(row, sessionSnapshotKeys) ||
    !isNonEmptyString(row.session_id) ||
    !isNonEmptyString(row.case_id) ||
    typeof row.status !== 'string' ||
    !sessionStatuses.has(row.status as SimulationSessionStatus) ||
    !isNonEmptyString(row.current_step_id) ||
    !isNonEmptyString(row.current_step_key) ||
    !isInteger(row.score_total) ||
    !isInteger(row.decision_count) ||
    row.decision_count < 0 ||
    !isNonEmptyString(row.started_at) ||
    typeof row.resumed !== 'boolean' ||
    !isNonEmptyString(row.presentation_state)
  ) {
    return null
  }

  const presentationState = parsePresentationState(row.presentation_state)

  if (!presentationState) {
    return null
  }

  const noRecordedDecision =
    row.selected_option_id === null &&
    row.classification === null &&
    row.score_delta === null &&
    row.feedback === null &&
    row.consequence === null &&
    row.next_step_key === null &&
    row.transition_completed === null

  let recordedDecision: SimulationSessionSnapshot['recordedDecision'] = null

  if (!noRecordedDecision) {
    if (!isNonEmptyString(row.selected_option_id)) {
      return null
    }

    const transition = parseTransition(row, 'transition_completed')

    if (!transition) {
      return null
    }

    recordedDecision = {
      selectedOptionId: row.selected_option_id,
      transition,
    }
  }

  return {
    sessionId: row.session_id,
    caseId: row.case_id,
    status: row.status as SimulationSessionStatus,
    currentStepId: row.current_step_id,
    currentStepKey: row.current_step_key,
    scoreTotal: row.score_total,
    decisionCount: row.decision_count,
    startedAt: row.started_at,
    resumed: row.resumed,
    presentationState,
    recordedDecision,
  }
}

export function parseRecordedSimulationDecision(
  value: unknown,
): RecordedSimulationDecision | null {
  const row = firstRow(value)

  if (
    !row ||
    !hasOnlyKeys(row, recordedDecisionKeys) ||
    !isNonEmptyString(row.action_id) ||
    !isNonEmptyString(row.session_id) ||
    !isNonEmptyString(row.step_id) ||
    !isNonEmptyString(row.selected_option_id) ||
    !isInteger(row.score_total) ||
    !isInteger(row.decision_count) ||
    row.decision_count < 1 ||
    !isNonEmptyString(row.created_at) ||
    typeof row.replayed !== 'boolean'
  ) {
    return null
  }

  const transition = parseTransition(row, 'completed')

  if (!transition?.evaluation) {
    return null
  }

  return {
    actionId: row.action_id,
    sessionId: row.session_id,
    stepId: row.step_id,
    selectedOptionId: row.selected_option_id,
    transition: transition as SimulationTransition & {
      evaluation: StepEvaluation
    },
    scoreTotal: row.score_total,
    decisionCount: row.decision_count,
    createdAt: row.created_at,
    replayed: row.replayed,
  }
}

export function parseAdvanceSimulationResult(
  value: unknown,
): AdvanceSimulationResult | null {
  const row = firstRow(value)

  if (
    !row ||
    !hasOnlyKeys(row, advanceResultKeys) ||
    !isNonEmptyString(row.session_id) ||
    (row.status !== 'in_progress' && row.status !== 'completed') ||
    !isNonEmptyString(row.current_step_id) ||
    !isNonEmptyString(row.current_step_key) ||
    !isInteger(row.score_total) ||
    !isInteger(row.decision_count) ||
    row.decision_count < 0 ||
    !isNullableString(row.completed_at) ||
    !isNonEmptyString(row.previous_step_id) ||
    !isNullableString(row.presentation_state) ||
    typeof row.replayed !== 'boolean'
  ) {
    return null
  }

  if (
    (row.status === 'completed' && !isNonEmptyString(row.completed_at)) ||
    (row.status !== 'completed' && row.completed_at !== null)
  ) {
    return null
  }

  const presentationState =
    row.presentation_state === null
      ? null
      : parsePresentationState(row.presentation_state, 'stable')

  if (row.presentation_state !== null && !presentationState) {
    return null
  }

  return {
    sessionId: row.session_id,
    status: row.status as SimulationSessionStatus,
    currentStepId: row.current_step_id,
    currentStepKey: row.current_step_key,
    scoreTotal: row.score_total,
    decisionCount: row.decision_count,
    completedAt: row.completed_at,
    previousStepId: row.previous_step_id,
    presentationState,
    replayed: row.replayed,
  }
}
