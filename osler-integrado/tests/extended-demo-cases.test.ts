// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import * as local from '../src/features/teaching/localStore'
import { extendedDemoCaseDefinitions } from '../src/features/teaching/extendedDemoCases'
import { demoStudents, demoTeacher } from '../src/features/teaching/demoFixtures'
import { validateDraft } from '../src/features/teaching/validation'

beforeEach(() => localStorage.clear())

describe('dois novos casos completos', () => {
  for (const definition of extendedDemoCaseDefinitions) {
    it.each([0, 1, 2])(`${definition.createDraft().course}: conclui sete etapas escolhendo alternativas de índice %i`, optionIndex => {
      const draft = definition.createDraft()
      expect(validateDraft(draft)).toBeNull()
      expect(draft.reviewed).toBe(false)
      expect(validateDraft(draft, true)).toMatch(/revisão/)
      expect(draft.steps).toHaveLength(7)
      expect(draft.steps.filter(step => step.type === 'decision')).toHaveLength(5)
      const student = demoStudents[draft.course === 'nursing' ? 2 : 5]
      local.loginLocal(student.email)
      local.localSetCourse(draft.course)
      const assignment = local.localStudentWorkspace().assignments.find(item => item.id === definition.assignmentId)!
      expect(assignment).toMatchObject({ stepCount: 7, expectedDecisions: 5, caseId: definition.caseId })
      const session = local.localStart(definition.caseId, assignment.id)
      let step = local.localVisibleStep(definition.caseId, session.currentStepKey)
      const visited: string[] = []
      let expectedScore = 0
      for (const authorStep of draft.steps) {
        expect(step.stepKey).toBe(authorStep.key)
        visited.push(step.stepKey)
        if (step.type === 'decision') {
          const choice = authorStep.options[optionIndex]
          expectedScore += choice.scoreDelta
          const result = local.localRecord(session.sessionId, step.id, choice.id)
          expect(result.transition.evaluation).toMatchObject({ feedback: choice.feedback, consequence: choice.consequence })
          expect(local.localRecord(session.sessionId, step.id, choice.id).replayed).toBe(true)
        }
        const advanced = local.localAdvance(session.sessionId, step.id)
        if (advanced.status === 'completed') {
          expect(visited).toHaveLength(7)
          break
        }
        step = local.localVisibleStep(definition.caseId, advanced.currentStepKey)
      }
      const debrief = local.localStudentDebrief(session.sessionId)
      expect(debrief.decisions).toHaveLength(5)
      expect(debrief.summary).toMatchObject({ scoreTotal: expectedScore, decisionCount: 5 })
      expect(debrief.references).toHaveLength(2)
      expect(debrief.references.every(reference => reference.url?.startsWith('https://'))).toBe(true)
      expect(local.localStudentWorkspace().attempts.find(item => item.id === session.sessionId)?.status).toBe('completed')
      local.loginLocal(demoTeacher.email, 'teacher')
      expect(local.localTeacherDebrief(session.sessionId).debrief).toEqual(debrief)
    })
  }

  it('atualiza dados anteriores uma única vez sem apagar sessões, vínculos ou atividades encerradas', () => {
    local.loginLocal(demoTeacher.email, 'teacher')
    const prior = JSON.parse(localStorage.getItem(local.localStoreKey)!)
    prior.cases = prior.cases.filter((item: { id: string }) => !extendedDemoCaseDefinitions.some(definition => definition.caseId === item.id))
    prior.assignments = prior.assignments.filter((item: { id: string }) => !extendedDemoCaseDefinitions.some(definition => definition.assignmentId === item.id))
    delete prior.contentPacks
    prior.sessions[0].feedback = 'Devolutiva que precisa permanecer.'
    prior.assignments[0].status = 'closed'
    localStorage.setItem(local.localStoreKey, JSON.stringify(prior))
    local.localTeacherWorkspace()
    const upgraded = JSON.parse(localStorage.getItem(local.localStoreKey)!)
    expect(upgraded.sessions).toEqual(prior.sessions)
    expect(upgraded.enrollments).toEqual(prior.enrollments)
    expect(upgraded.cases).toHaveLength(prior.cases.length + 2)
    expect(upgraded.assignments).toHaveLength(prior.assignments.length + 2)
    expect(upgraded.assignments[0].status).toBe('closed')
    const definition = extendedDemoCaseDefinitions[0]
    local.localCloseAssignment(definition.assignmentId, 'closed')
    local.localArchiveCase(definition.caseId)
    const after = local.localTeacherWorkspace()
    expect(after.cases.filter(item => item.id === definition.caseId)).toHaveLength(1)
    expect(after.cases.find(item => item.id === definition.caseId)?.status).toBe('archived')
    expect(after.assignments.find(item => item.id === definition.assignmentId)?.status).toBe('closed')
  })
})
