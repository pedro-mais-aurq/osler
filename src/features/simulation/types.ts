export type ClinicalPresentationState =
  | 'stable'
  | 'warning'
  | 'critical'
  | 'recovery'

export type StepClassification =
  | 'ideal'
  | 'acceptable'
  | 'needs_improvement'
  | 'unsafe'

export type CasePublicationStatus = 'draft' | 'published' | 'archived'

export interface SimulationCaseSummary {
  id: string
  slug: string
  title: string
  description: string
  educationalObjective: string | null
  status: CasePublicationStatus
}

export interface SimulationPatient {
  id: string
  displayName: string
  ageYears: number | null
  sexOrAnatomyContext: string | null
  pronouns: string | null
  visualRef: string | null
}

export interface StepOption {
  id: string
  label: string
}

export type LaboratoryStage =
  | 'request'
  | 'sample'
  | 'preanalytical'
  | 'analysis'
  | 'result'

export interface LaboratoryField {
  label: string
  value: string
}

export interface LaboratoryVisibleData {
  stage: LaboratoryStage
  title: string
  fields: LaboratoryField[]
  notes?: string[]
}

export interface StepContent {
  body: string
  observations: string[]
  laboratory?: LaboratoryVisibleData
}

interface BaseCaseStep {
  id: string
  caseId: string
  position: number
  stepKey: string
  title: string | null
  content: StepContent
  presentationState: ClinicalPresentationState
}

export interface InformationStep extends BaseCaseStep {
  type: 'information'
}

export interface DecisionStep extends BaseCaseStep {
  type: 'decision'
  options: StepOption[]
}

export type CaseStep = InformationStep | DecisionStep

export interface SimulationCase {
  case: SimulationCaseSummary
  patient: SimulationPatient
  firstStep: CaseStep
}

export interface StepEvaluation {
  classification: StepClassification
  scoreDelta: number
  feedback: string
  consequence: string | null
}

export interface SimulationTransition {
  evaluation: StepEvaluation | null
  nextStepKey: string | null
  completed: boolean
  presentationState: ClinicalPresentationState | null
}

export type SimulationSessionStatus =
  | 'in_progress'
  | 'completed'
  | 'abandoned'

export interface RestoredSimulationDecision {
  selectedOptionId: string
  transition: SimulationTransition
}

export interface SimulationSessionSnapshot {
  sessionId: string
  caseId: string
  status: SimulationSessionStatus
  currentStepId: string
  currentStepKey: string
  scoreTotal: number
  decisionCount: number
  startedAt: string
  resumed: boolean
  presentationState: ClinicalPresentationState
  recordedDecision: RestoredSimulationDecision | null
}

export interface RecordedSimulationDecision {
  actionId: string
  sessionId: string
  stepId: string
  selectedOptionId: string
  transition: SimulationTransition & { evaluation: StepEvaluation }
  scoreTotal: number
  decisionCount: number
  createdAt: string
  replayed: boolean
}

export interface AdvanceSimulationResult {
  sessionId: string
  status: SimulationSessionStatus
  currentStepId: string
  currentStepKey: string
  scoreTotal: number
  decisionCount: number
  completedAt: string | null
  previousStepId: string
  presentationState: ClinicalPresentationState | null
  replayed: boolean
}

export interface MinimalSimulationResult {
  sessionId: string
  caseId: string
  caseTitle: string
  score: number
  decisionCount: number
}

export type SimulationErrorScope = 'load' | 'start' | 'evaluation' | 'advance'

export interface SimulationError {
  scope: SimulationErrorScope
  message: string
  cause?: unknown
}

export type SimulationPhase =
  | 'idle'
  | 'loading'
  | 'intro'
  | 'starting'
  | 'step'
  | 'evaluating'
  | 'feedback'
  | 'advancing'
  | 'completed'
  | 'error'

export interface SimulationState {
  phase: SimulationPhase
  simulationCase: SimulationCase | null
  sessionId: string | null
  currentStep: CaseStep | null
  stepNumber: number
  selectedOptionId: string | null
  evaluation: StepEvaluation | null
  pendingTransition: SimulationTransition | null
  score: number
  decisionCount: number
  presentationState: ClinicalPresentationState
  error: SimulationError | null
}

export type SimulationAction =
  | { type: 'reset' }
  | { type: 'loadRequested' }
  | { type: 'loadSucceeded'; simulationCase: SimulationCase }
  | { type: 'loadFailed'; error: SimulationError }
  | { type: 'sessionStartRequested' }
  | { type: 'sessionStartFailed'; error: SimulationError }
  | {
      type: 'sessionRestored'
      session: SimulationSessionSnapshot
      currentStep: CaseStep
    }
  | { type: 'optionSelected'; optionId: string }
  | { type: 'transitionRequested' }
  | {
      type: 'decisionRecorded'
      decision: RecordedSimulationDecision
    }
  | { type: 'transitionFailed'; error: SimulationError }
  | { type: 'advanceRequested' }
  | {
      type: 'advanceSucceeded'
      step: CaseStep
      result: AdvanceSimulationResult
    }
  | { type: 'advanceFailed'; error: SimulationError }
  | { type: 'completed'; result: AdvanceSimulationResult }
