import type { StudentCourse } from '../../types/database'

export function parseEntryCourse(value: string | null): StudentCourse | null {
  return value === 'nursing' || value === 'clinical_analysis' ? value : null
}

export const loginCourseKey = 'osler.login.course'
