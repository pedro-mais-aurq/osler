import type { SimulationDebrief } from '../debrief/types'
import type {
  ClinicalPresentationState,
  StepClassification,
} from '../simulation/types'
import type { AppRole, CaseStatus, StudentCourse } from '../../types/database'

export interface PortalIdentity {
  userId: string
  email: string
  displayName: string
  role: AppRole
}

export interface Classroom {
  id: string
  teacherId: string
  name: string
  course: StudentCourse
  description: string
  term: string
  archived: boolean
  createdAt: string
  joinCode?: string
}

export interface Enrollment {
  id: string
  classroomId: string
  email: string
  studentId: string | null
  status: 'invited' | 'active' | 'revoked'
  createdAt: string
}

export interface AuthorOption {
  id: string
  label: string
  classification: StepClassification
  scoreDelta: number
  feedback: string
  consequence: string
  presentationState: ClinicalPresentationState
  nextStepKey: string // "next", "complete", or a later step key
}

export interface AuthorStep {
  key: string
  type: 'information' | 'decision'
  title: string
  body: string
  observations: string[]
  presentationState: ClinicalPresentationState
  options: AuthorOption[]
}

export interface CaseDraft {
  title: string
  course: StudentCourse
  description: string
  objective: string
  patientName: string
  patientAge: number
  pronouns: string
  reference: string
  reviewed: boolean
  visibility?: 'private' | 'public'
  steps: AuthorStep[]
}

export interface TeachingCase {
  id: string
  teacherId: string
  status: CaseStatus
  draft: CaseDraft
  createdAt: string
}

export interface Assignment {
  id: string
  classroomId: string
  caseId: string
  title: string
  dueAt: string | null
  status: 'open' | 'closed'
  createdAt: string
}

export interface AttemptSummary {
  id: string
  assignmentId: string | null
  caseId?: string
  studentId: string
  email: string
  caseTitle: string
  status: 'in_progress' | 'completed' | 'abandoned'
  scoreTotal: number
  decisionCount: number
  startedAt: string
  completedAt: string | null
  feedback: string
}

export interface TeacherWorkspace {
  classrooms: Classroom[]
  enrollments: Enrollment[]
  cases: TeachingCase[]
  assignments: Assignment[]
  attempts: AttemptSummary[]
}

export interface StudentAssignment extends Assignment {
  classroomName: string
  course: StudentCourse
  caseTitle: string
  description: string
  objective: string
  stepCount?: number
  expectedDecisions?: number
}

export interface StudentWorkspace {
  classrooms: Classroom[]
  assignments: StudentAssignment[]
  attempts: AttemptSummary[]
}

export interface PublicCaseSummary {
  id: string
  title: string
  course: StudentCourse
  description: string
  objective: string
  stepCount: number
  expectedDecisions: number
}

export interface PublicPracticeWorkspace {
  cases: PublicCaseSummary[]
  attempts: AttemptSummary[]
}

export interface TeacherDebrief {
  debrief: SimulationDebrief
  email: string
  feedback: string
}

export type ServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string }
