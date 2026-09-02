import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseConfiguration {
  url: string
  anonKey: string
}

interface ConfigurationResult {
  config: SupabaseConfiguration | null
  error: string | null
}

function readSupabaseConfiguration(): ConfigurationResult {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

  if (!url || !anonKey) {
    return {
      config: null,
      error:
        'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env para habilitar a conexão.',
    }
  }

  try {
    const parsedUrl = new URL(url)

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('protocolo inválido')
    }
  } catch {
    return {
      config: null,
      error: 'VITE_SUPABASE_URL não contém uma URL HTTP(S) válida.',
    }
  }

  return {
    config: { url, anonKey },
    error: null,
  }
}

const configuration = readSupabaseConfiguration()

export const supabaseConfigurationError = configuration.error
export const supabaseConfig = configuration.config

export const supabase: SupabaseClient | null = supabaseConfig
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null
