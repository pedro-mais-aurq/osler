export type AppRole = 'student' | 'teacher' | 'admin'
export type StudentCourse = 'nursing' | 'clinical_analysis'
export type CourseCode = StudentCourse
export type CaseStatus = 'draft' | 'published' | 'archived'

export interface StudentIdentity {
  userId: string
  role: AppRole
  course: StudentCourse | null
}

export interface ClinicalCaseHandoff {
  id: string
  slug: string
  title: string
  course: StudentCourse
  description: string
  educational_objective: string | null
  status: CaseStatus
}

export interface SimulationPatient {
  id: string
  display_name: string
  age_years: number | null
  sex_or_anatomy_context: string | null
  pronouns: string | null
}

export interface VisibleStepOption {
  id: string
  label: string
}

export interface VisibleCaseStep {
  id: string
  case_id: string
  position: number
  step_key: string
  step_type: 'information' | 'decision'
  title: string | null
  content: {
    body: string
    observations: string[]
  }
  options: VisibleStepOption[]
}

export interface SimulationCase {
  case: ClinicalCaseHandoff
  patient: SimulationPatient
  steps: VisibleCaseStep[]
}

export type StepClassification =
  | 'ideal'
  | 'acceptable'
  | 'needs_improvement'
  | 'unsafe'

export interface StepEvaluation {
  classification: StepClassification
  scoreDelta: number
  feedback: string
  consequence: string | null
}

export interface MinimalSimulationResult {
  caseId: string
  caseTitle: string
  score: number
  decisionCount: number
}

// Temporary domain surface. Replace it with CLI-generated Database types after
// the OSLER schema is available locally or in a correctly linked project.
