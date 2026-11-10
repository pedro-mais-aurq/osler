import type { DebriefReference } from '../debrief/types'
import type { AuthorOption, AuthorStep, CaseDraft } from './types'

export interface PracticeCaseDefinition {
  caseId: string
  assignmentId: string
  assignmentTitle: string
  createDraft: () => CaseDraft
  references: DebriefReference[]
}

export function information(key: string, title: string, body: string, observations: string[], presentationState: AuthorStep['presentationState'] = 'stable'): AuthorStep {
  return { key, title, body, observations, type: 'information', presentationState, options: [] }
}

export function decision(key: string, title: string, body: string, observations: string[], options: AuthorOption[], presentationState: AuthorStep['presentationState'] = 'warning'): AuthorStep {
  return { key, title, body, observations, options, type: 'decision', presentationState }
}

export function option(
  id: string,
  label: string,
  classification: AuthorOption['classification'],
  feedback: string,
  consequence: string,
  presentationState?: AuthorOption['presentationState'],
): AuthorOption {
  return {
    id, label, classification, feedback, consequence,
    scoreDelta: { ideal: 2, acceptable: 1, needs_improvement: 0, unsafe: -1 }[classification],
    presentationState: presentationState ?? (classification === 'ideal' ? 'recovery' : classification === 'unsafe' ? 'critical' : 'warning'),
    nextStepKey: 'next',
  }
}

export function referenceText(references: DebriefReference[]): string {
  const citations = references.map(reference => {
    const year = reference.year === null ? '' : ` (${reference.year})`
    return `${reference.authority}. ${reference.title}${year}. ${reference.url ?? ''}`.trimEnd()
  })
  return ['Roteiro fictício de demonstração. Revisão clínica e pedagógica independente pendente.', ...citations].join('\n')
}
