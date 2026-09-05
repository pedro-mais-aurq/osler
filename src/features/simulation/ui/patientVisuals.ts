export const neutralPatientVisualRef = 'patients/patient-neutral.svg'
export const femalePatientVisualRef = 'patients/patient-female-neutral.svg'

export const patientVisualFallbackByPronouns = {
  'ela/dela': femalePatientVisualRef,
} as const

function isSafeRelativeAssetPath(value: string) {
  return (
    value.startsWith('patients/') &&
    /^[a-z\d][a-z\d/_.-]*$/i.test(value) &&
    !value.includes('..') &&
    !value.includes('\\') &&
    !value.includes('//') &&
    !/^[a-z][a-z\d+.-]*:/i.test(value)
  )
}

function withBaseUrl(relativePath: string) {
  const baseUrl = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`

  return `${baseUrl}${relativePath}`
}

export function getPatientVisualFallback(pronouns: string | null) {
  const normalizedPronouns = pronouns?.trim().toLocaleLowerCase('pt-BR') ?? ''

  return (
    patientVisualFallbackByPronouns[
      normalizedPronouns as keyof typeof patientVisualFallbackByPronouns
    ] ?? neutralPatientVisualRef
  )
}

export function resolvePatientVisualRef(
  visualRef: string | null,
  pronouns: string | null = null,
) {
  const candidate = visualRef?.trim().replace(/^\/+/, '') ?? ''
  const relativePath = isSafeRelativeAssetPath(candidate)
    ? candidate
    : getPatientVisualFallback(pronouns)

  return withBaseUrl(relativePath)
}

export function resolveNeutralPatientVisualRef() {
  return withBaseUrl(neutralPatientVisualRef)
}
