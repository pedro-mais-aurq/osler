import { supabase, supabaseConfigurationError } from '../lib/supabase'
import type { ClinicalCaseCatalogRow } from '../types/database'

export interface CaseCatalogResult {
  cases: ClinicalCaseCatalogRow[]
  error: string | null
  requiresAuthentication: boolean
}

export async function getPublishedCases(): Promise<CaseCatalogResult> {
  if (!supabase) {
    return {
      cases: [],
      error: supabaseConfigurationError ?? 'Cliente Supabase não configurado.',
      requiresAuthentication: false,
    }
  }

  const { data, error } = await supabase
    .from('clinical_cases')
    .select(
      'id, patient_id, slug, title, course, description, educational_objective, status',
    )
    .eq('status', 'published')
    .order('title')

  if (error) {
    const requiresAuthentication = error.code === '42501'

    return {
      cases: [],
      error: requiresAuthentication
        ? 'A consulta de casos exige um usuário autenticado. A identidade será criada na Parte 3.'
        : error.message,
      requiresAuthentication,
    }
  }

  return {
    cases: (data ?? []) as ClinicalCaseCatalogRow[],
    error: null,
    requiresAuthentication: false,
  }
}
