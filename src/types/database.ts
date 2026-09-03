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

// Temporary domain surface for P3. Replace it with CLI-generated Database types
// after the OSLER schema is available locally or in a correctly linked project.
