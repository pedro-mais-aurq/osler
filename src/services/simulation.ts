import { parseSimulationTransition } from '../features/simulation/parsers'
import type {
  SimulationTransition,
  StepClassification,
  StepEvaluation,
} from '../features/simulation/types'
import { supabase, supabaseConfigurationError } from '../lib/supabase'

export type SimulationTransitionResult =
  | { ok: true; transition: SimulationTransition }
  | { ok: false; message: string; cause?: unknown }

export type StepEvaluationResult =
  | { ok: true; evaluation: StepEvaluation }
  | { ok: false; message: string; cause?: unknown }

const classifications: ReadonlySet<StepClassification> = new Set([
  'ideal',
  'acceptable',
  'needs_improvement',
  'unsafe',
])

function normalizeLegacyEvaluation(data: unknown): StepEvaluation | null {
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

export async function resolveSimulationTransition(
  caseId: string,
  stepId: string,
  optionId: string | null,
): Promise<SimulationTransitionResult> {
  if (!supabase) {
    return {
      ok: false,
      message: 'A conexão com o OSLER ainda não está configurada.',
      cause: supabaseConfigurationError,
    }
  }

  const { data, error } = await supabase.rpc('resolve_simulation_transition', {
    p_case_id: caseId,
    p_step_id: stepId,
    p_option_id: optionId,
  })

  if (error) {
    return {
      ok: false,
      message:
        optionId === null
          ? 'Não foi possível avançar esta etapa. Tente novamente.'
          : 'Não foi possível avaliar sua escolha. Tente novamente.',
      cause: error,
    }
  }

  const transition = parseSimulationTransition(data)

  if (!transition) {
    return {
      ok: false,
      message: 'A transição retornou um formato inesperado. Tente novamente.',
      cause: data,
    }
  }

  return { ok: true, transition }
}

// P4 compatibility surface. The P8 engine records decisions through the
// session-bound persistence RPC instead of evaluating without a session.
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

  const evaluation = normalizeLegacyEvaluation(data)

  if (!evaluation) {
    return {
      ok: false,
      message: 'A avaliação retornou um formato inesperado. Tente novamente.',
      cause: data,
    }
  }

  return { ok: true, evaluation }
}
