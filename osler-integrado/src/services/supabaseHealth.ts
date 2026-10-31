import {
  supabase,
  supabaseConfig,
  supabaseConfigurationError,
} from '../lib/supabase'

export interface SupabaseHealthResult {
  ok: boolean
  message: string
}

const healthCheckTimeoutMs = 5_000

export async function checkSupabaseConnection(): Promise<SupabaseHealthResult> {
  if (!supabase || !supabaseConfig) {
    return {
      ok: false,
      message: supabaseConfigurationError ?? 'Cliente Supabase não configurado.',
    }
  }

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), healthCheckTimeoutMs)

  try {
    const response = await fetch(`${supabaseConfig.url}/auth/v1/health`, {
      headers: {
        apikey: supabaseConfig.anonKey,
      },
      method: 'GET',
      signal: controller.signal,
    })

    if (!response.ok) {
      return {
        ok: false,
        message: `Não foi possível conectar ao Supabase (HTTP ${response.status}).`,
      }
    }

    return {
      ok: true,
      message: 'Supabase conectado.',
    }
  } catch (error: unknown) {
    const detail =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'tempo limite excedido'
        : error instanceof Error
          ? error.message
          : 'erro desconhecido'

    return {
      ok: false,
      message: `Não foi possível conectar ao Supabase: ${detail}.`,
    }
  } finally {
    window.clearTimeout(timeoutId)
  }
}
