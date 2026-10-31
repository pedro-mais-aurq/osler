import { isLocalMode } from '../lib/dataMode'
import * as local from '../features/teaching/localStore'
import { localResult } from './localAdapter'
import {
  parseAbandonedSimulationSession,
  parseAdvanceSimulationResult,
  parseRecordedSimulationDecision,
  parseSimulationSessionSnapshot,
} from '../features/simulation/persistenceParsers'
import type {
  AbandonedSimulationSession,
  AdvanceSimulationResult,
  RecordedSimulationDecision,
  SimulationSessionSnapshot,
} from '../features/simulation/types'
import { supabase, supabaseConfigurationError } from '../lib/supabase'

export type StartSimulationSessionResult =
  | { ok: true; session: SimulationSessionSnapshot }
  | { ok: false; message: string; cause?: unknown }

export type RecordSimulationDecisionResult =
  | { ok: true; decision: RecordedSimulationDecision }
  | { ok: false; message: string; cause?: unknown }

export type AdvanceSimulationSessionResult =
  | { ok: true; result: AdvanceSimulationResult }
  | { ok: false; message: string; cause?: unknown }

export type AbandonSimulationSessionResult =
  | { ok: true; session: AbandonedSimulationSession }
  | { ok: false; message: string; cause?: unknown }

function unavailable(message: string) {
  return {
    ok: false as const,
    message,
    cause: supabaseConfigurationError,
  }
}

export async function startOrResumeSimulationSession(
  caseId: string,
  assignmentId?: string | null,
): Promise<StartSimulationSessionResult> {
  if (isLocalMode)
    return localResult(() => local.localStart(caseId, assignmentId), 'session')
  if (!supabase) {
    return unavailable(
      'Não foi possível iniciar a simulação agora. Tente novamente.',
    )
  }

  const { data, error } = await supabase.rpc(
    'start_or_resume_simulation_session',
    {
      p_case_id: caseId,
      ...(assignmentId ? { p_assignment_id: assignmentId } : {}),
    },
  )

  if (error) {
    return {
      ok: false,
      message:
        'Não foi possível iniciar ou retomar a simulação. Tente novamente.',
      cause: error,
    }
  }

  const session = parseSimulationSessionSnapshot(data)

  if (
    !session ||
    session.caseId !== caseId ||
    session.status !== 'in_progress'
  ) {
    return {
      ok: false,
      message: 'A sessão retornou um formato inesperado. Tente novamente.',
      cause: data,
    }
  }

  return { ok: true, session }
}

export async function recordSimulationDecision(
  sessionId: string,
  stepId: string,
  optionId: string,
): Promise<RecordSimulationDecisionResult> {
  if (isLocalMode)
    return localResult(
      () => local.localRecord(sessionId, stepId, optionId),
      'decision',
    )
  if (!supabase) {
    return unavailable(
      'Não foi possível registrar sua escolha. Tente novamente.',
    )
  }

  const { data, error } = await supabase.rpc('record_simulation_decision', {
    p_session_id: sessionId,
    p_step_id: stepId,
    p_option_id: optionId,
  })

  if (error) {
    return {
      ok: false,
      message: 'Não foi possível registrar sua escolha. Tente novamente.',
      cause: error,
    }
  }

  const decision = parseRecordedSimulationDecision(data)

  if (
    !decision ||
    decision.sessionId !== sessionId ||
    decision.stepId !== stepId ||
    decision.selectedOptionId !== optionId
  ) {
    return {
      ok: false,
      message:
        'O registro da escolha retornou um formato inesperado. Tente novamente.',
      cause: data,
    }
  }

  return { ok: true, decision }
}

export async function advanceSimulationSession(
  sessionId: string,
  stepId: string,
): Promise<AdvanceSimulationSessionResult> {
  if (isLocalMode)
    return localResult(() => local.localAdvance(sessionId, stepId), 'result')
  if (!supabase) {
    return unavailable('Não foi possível avançar esta etapa. Tente novamente.')
  }

  const { data, error } = await supabase.rpc('advance_simulation_session', {
    p_session_id: sessionId,
    p_step_id: stepId,
  })

  if (error) {
    return {
      ok: false,
      message: 'Não foi possível avançar esta etapa. Tente novamente.',
      cause: error,
    }
  }

  const result = parseAdvanceSimulationResult(data)

  if (
    !result ||
    result.sessionId !== sessionId ||
    result.previousStepId !== stepId
  ) {
    return {
      ok: false,
      message: 'O avanço retornou um formato inesperado. Tente novamente.',
      cause: data,
    }
  }

  return { ok: true, result }
}

export async function abandonSimulationSession(
  sessionId: string,
): Promise<AbandonSimulationSessionResult> {
  if (isLocalMode)
    return localResult(() => local.localAbandon(sessionId), 'session')
  if (!supabase) {
    return unavailable(
      'Não foi possível reiniciar esta tentativa. Tente novamente.',
    )
  }

  const { data, error } = await supabase.rpc('abandon_simulation_session', {
    p_session_id: sessionId,
  })

  if (error) {
    return {
      ok: false,
      message: 'Não foi possível reiniciar esta tentativa. Tente novamente.',
      cause: error,
    }
  }

  const session = parseAbandonedSimulationSession(data)

  if (!session || session.sessionId !== sessionId) {
    return {
      ok: false,
      message: 'O reinício retornou um formato inesperado. Tente novamente.',
      cause: data,
    }
  }

  return { ok: true, session }
}
