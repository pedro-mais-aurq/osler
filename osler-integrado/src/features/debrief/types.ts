import type { StepClassification } from '../simulation/types'

export interface DebriefDecision {
  actionId: string
  stepId: string
  stepKey: string
  stepTitle: string | null
  position: number
  selectedOptionId: string
  selectedOptionLabel: string
  classification: StepClassification
  scoreDelta: number
  feedback: string
  consequence: string | null
  createdAt: string
}

export interface DebriefReference {
  id: string
  authority: string
  title: string
  year: number | null
  url: string | null
  verifiedOn: string | null
}

export interface DebriefClassificationCounts {
  ideal: number
  acceptable: number
  needsImprovement: number
  unsafe: number
}

export interface DebriefSummary {
  scoreTotal: number
  decisionCount: number
  classifications: DebriefClassificationCounts
}

export interface SimulationDebrief {
  sessionId: string
  caseId: string
  caseTitle: string
  educationalObjective: string | null
  startedAt: string
  completedAt: string
  summary: DebriefSummary
  decisions: DebriefDecision[]
  references: DebriefReference[]
}
