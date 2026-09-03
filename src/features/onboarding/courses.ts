import type { StudentCourse } from '../../types/database'

export const studentCourseOptions: ReadonlyArray<{
  value: StudentCourse
  label: string
}> = [
  { value: 'nursing', label: 'Enfermagem' },
  { value: 'clinical_analysis', label: 'Análises Clínicas' },
]

export function getStudentCourseLabel(course: StudentCourse): string {
  return studentCourseOptions.find((option) => option.value === course)?.label ?? course
}
