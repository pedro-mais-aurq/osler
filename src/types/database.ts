export type CourseCode = 'nursing' | 'clinical_analysis'
export type CaseStatus = 'draft' | 'published' | 'archived'

export interface ClinicalCaseCatalogRow {
  id: string
  patient_id: string
  slug: string
  title: string
  course: CourseCode
  description: string
  educational_objective: string | null
  status: CaseStatus
}

// Temporary P2 surface for the only database read exposed by the frontend.
// Replace it with generated Database types after the migration is applied.
