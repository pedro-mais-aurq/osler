import { createId } from '../../lib/createId'
import type { AuthorOption, AuthorStep, CaseDraft } from './types'

export const classificationLabels = {
  ideal: 'Ideal',
  acceptable: 'Aceitável',
  needs_improvement: 'Precisa melhorar',
  unsafe: 'Insegura',
}
export const presentationLabels = {
  stable: 'Estável',
  warning: 'Atenção',
  critical: 'Crítico',
  recovery: 'Recuperação',
}
export const courseLabels = {
  nursing: 'Enfermagem',
  clinical_analysis: 'Análises clínicas',
}
export const normalizeEmail = (email: string) => email.trim().toLowerCase()
export const validEmail = (email: string) =>
  email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

export function newOption(): AuthorOption {
  return {
    id: createId(),
    label: '',
    classification: 'acceptable',
    scoreDelta: 1,
    feedback: '',
    consequence: '',
    presentationState: 'stable',
    nextStepKey: 'next',
  }
}
export function newStep(type: AuthorStep['type'] = 'information'): AuthorStep {
  return {
    key: `etapa-${createId()}`,
    type,
    title: '',
    body: '',
    observations: [],
    presentationState: 'stable',
    options: type === 'decision' ? [newOption(), newOption()] : [],
  }
}
export function newCaseDraft(): CaseDraft {
  return {
    title: '',
    course: 'nursing',
    description: '',
    objective: '',
    patientName: '',
    patientAge: 40,
    pronouns: 'ela/dela',
    reference: '',
    reviewed: false,
    visibility: 'private',
    steps: [newStep(), newStep('decision')],
  }
}

// The SQL authoring RPC repeats these checks; the browser is not an authority.
export function validateDraft(
  draft: CaseDraft,
  publish = false,
): string | null {
  if (draft.visibility !== undefined && !['private', 'public'].includes(draft.visibility)) return 'Selecione a visibilidade pública ou privada do caso.'
  for (const [value, label, max] of [
    [draft.title, 'Título', 160],
    [draft.description, 'Descrição', 4000],
    [draft.objective, 'Objetivo', 2000],
    [draft.patientName, 'Nome do paciente', 120],
  ] as const) {
    if (
      ((publish || label === 'Título') && !value.trim()) ||
      value.length > max
    )
      return `${label}: preencha até ${max} caracteres.`
  }
  if (!['nursing', 'clinical_analysis'].includes(draft.course))
    return 'Selecione um curso válido.'
  if (
    !Number.isInteger(draft.patientAge) ||
    draft.patientAge < 0 ||
    draft.patientAge > 120
  )
    return 'Informe uma idade entre 0 e 120.'
  if (draft.pronouns.length > 80 || draft.reference.length > 4000)
    return 'Pronomes ou referências excedem o limite de caracteres.'
  if (draft.steps.length < (publish ? 1 : 0) || draft.steps.length > 30)
    return 'O caso deve conter de 1 a 30 etapas.'
  const keys = draft.steps.map((s) => s.key)
  if (
    new Set(keys).size !== keys.length ||
    keys.some((k) => !/^[a-zA-Z0-9-]{1,80}$/.test(k))
  )
    return 'As etapas precisam de identificadores únicos.'
  if (publish && !draft.steps.some((s) => s.type === 'decision'))
    return 'Inclua pelo menos uma etapa de decisão.'
  for (const [i, step] of draft.steps.entries()) {
    const prefix = `Etapa ${i + 1}`
    if (
      !['information', 'decision'].includes(step.type) ||
      (publish && !step.title.trim()) ||
      step.title.length > 160 ||
      (publish && !step.body.trim()) ||
      step.body.length > 8000
    )
      return `${prefix}: preencha título e contexto dentro dos limites.`
    if (!(step.presentationState in presentationLabels))
      return `${prefix}: estado visual inválido.`
    if (
      step.observations.length > 20 ||
      step.observations.some((s) => typeof s !== 'string' || s.length > 1000)
    )
      return `${prefix}: revise as observações.`
    if (step.type !== 'decision') continue
    if (step.options.length < 2 || step.options.length > 8)
      return `${prefix}: inclua entre 2 e 8 alternativas.`
    if (new Set(step.options.map((o) => o.id)).size !== step.options.length)
      return `${prefix}: alternativas duplicadas.`
    for (const option of step.options) {
      if (
        !/^[a-zA-Z0-9-]{1,80}$/.test(option.id) ||
        (publish && !option.label.trim()) ||
        option.label.length > 2000 ||
        (publish && !option.feedback.trim()) ||
        option.feedback.length > 4000 ||
        option.consequence.length > 2000
      )
        return `${prefix}: complete as alternativas e seus feedbacks.`
      if (
        !(option.classification in classificationLabels) ||
        !(option.presentationState in presentationLabels)
      )
        return `${prefix}: avaliação inválida.`
      if (
        !Number.isInteger(option.scoreDelta) ||
        Math.abs(option.scoreDelta) > 100
      )
        return `${prefix}: a pontuação deve ser um inteiro de −100 a 100.`
      if (
        !['next', 'complete'].includes(option.nextStepKey) &&
        keys.indexOf(option.nextStepKey) <= i
      )
        return `${prefix}: o destino deve ser uma etapa posterior.`
    }
  }
  if (publish && (!draft.reviewed || !draft.reference.trim()))
    return 'Para publicar, informe as referências e confirme a revisão clínica e pedagógica.'
  return null
}
