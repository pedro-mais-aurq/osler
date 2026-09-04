export type AppRole = 'student' | 'teacher' | 'admin'
export type StudentCourse = 'nursing' | 'clinical_analysis'
export type CourseCode = StudentCourse
export type CaseStatus = 'draft' | 'published' | 'archived'

export interface StudentIdentity {
  userId: string
  role: AppRole
  course: StudentCourse | null
}

// Temporary domain surface. Replace it with CLI-generated Database types after
// the OSLER schema is available locally or in a correctly linked project. The
// simulation domain lives in features/simulation and is mapped from DB rows.
