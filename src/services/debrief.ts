import {
  isValidDebriefSessionId,
  parseSimulationDebrief,
} from '../features/debrief/parsers'
import type { SimulationDebrief } from '../features/debrief/types'
import { supabase, supabaseConfigurationError } from '../lib/supabase'

export type SimulationDebriefResult =
  | { ok: true; debrief: SimulationDebrief }
  | {
      ok: false
      reason: 'unavailable' | 'error'
      message: string
      cause?: unknown
    }

function readErrorCode(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('code' in value)) {
    return null
  }

  return typeof value.code === 'string' ? value.code : null
}

export async function getSimulationDebrief(
  sessionId: string,
): Promise<SimulationDebriefResult> {
  if (!isValidDebriefSessionId(sessionId)) {
    return {
      ok: false,
      reason: 'unavailable',
      message: 'Este resultado não está disponível.',
    }
  }

  if (!supabase) {
    return {
      ok: false,
      reason: 'error',
      message: 'Não foi possível carregar este debrief. Tente novamente.',
      cause: supabaseConfigurationError,
    }
  }

  const { data, error } = await supabase.rpc('get_simulation_debrief', {
    p_session_id: sessionId,
  })

  if (error) {
    const errorCode = readErrorCode(error)
    const unavailable = errorCode === '42501' || errorCode === 'P0001'

    return {
      ok: false,
      reason: unavailable ? 'unavailable' : 'error',
      message: unavailable
        ? 'Este resultado não está disponível.'
        : 'Não foi possível carregar este debrief. Tente novamente.',
      cause: error,
    }
  }

  const debrief = parseSimulationDebrief(data)

  if (!debrief || debrief.sessionId !== sessionId) {
    return {
      ok: false,
      reason: 'error',
      message: 'Não foi possível carregar este debrief. Tente novamente.',
      cause: data,
    }
  }

  return { ok: true, debrief }
}
