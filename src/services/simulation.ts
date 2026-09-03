import { supabase, supabaseConfigurationError } from '../lib/supabase'
import type {
  StepClassification,
  StepEvaluation,
} from '../types/database'

export type StepEvaluationResult =
  | { ok: true; evaluation: StepEvaluation }
  | { ok: false; message: string; cause?: unknown }

const classifications: ReadonlySet<StepClassification> = new Set([
  'ideal',
  'acceptable',
  'needs_improvement',
  'unsafe',
])

function normalizeEvaluation(data: unknown): StepEvaluation | null {
  const row = Array.isArray(data) ? data[0] : data

  if (!row || typeof row !== 'object') {
    return null
  }

  const evaluation = row as Record<string, unknown>

  if (
    typeof evaluation.classification !== 'string' ||
    !classifications.has(evaluation.classification as StepClassification) ||
    typeof evaluation.score_delta !== 'number' ||
    !Number.isInteger(evaluation.score_delta) ||
    typeof evaluation.feedback !== 'string' ||
    (evaluation.consequence !== null &&
      typeof evaluation.consequence !== 'string')
  ) {
    return null
  }

  return {
    classification: evaluation.classification as StepClassification,
    scoreDelta: evaluation.score_delta,
    feedback: evaluation.feedback,
    consequence: evaluation.consequence,
  }
}

export async function evaluateCaseStep(
  caseId: string,
  stepId: string,
  optionId: string,
): Promise<StepEvaluationResult> {
  if (!supabase) {
    return {
      ok: false,
      message: 'A conexão com o OSLER ainda não está configurada.',
      cause: supabaseConfigurationError,
    }
  }

  const { data, error } = await supabase.rpc('evaluate_case_step', {
    p_case_id: caseId,
    p_step_id: stepId,
    p_option_id: optionId,
  })

  if (error) {
    return {
      ok: false,
      message: 'Não foi possível avaliar sua escolha. Tente novamente.',
      cause: error,
    }
  }

  const evaluation = normalizeEvaluation(data)

  if (!evaluation) {
    return {
      ok: false,
      message: 'A avaliação retornou um formato inesperado. Tente novamente.',
      cause: data,
    }
  }

  return { ok: true, evaluation }
}
