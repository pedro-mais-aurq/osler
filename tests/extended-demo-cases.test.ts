// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import * as local from '../src/features/teaching/localStore'
import { extendedDemoCaseDefinitions, extendedDemoPack } from '../src/features/teaching/extendedDemoCases'
import { demoStudents, demoTeacher } from '../src/features/teaching/demoFixtures'
import { largePracticeCasePack } from '../src/features/teaching/practiceCasePacks'
import { validateDraft } from '../src/features/teaching/validation'

beforeEach(() => localStorage.clear())

describe('casos completos da demonstração', () => {
  const cases = [
    { definitions: extendedDemoCaseDefinitions, stepCount: 7, decisionCount: 5 },
    { definitions: largePracticeCasePack.definitions, stepCount: 12, decisionCount: 9 },
  ].flatMap(({ definitions, stepCount, decisionCount }) =>
    definitions.map(definition => ({ definition, stepCount, decisionCount })),
  )
  for (const { definition, stepCount, decisionCount } of cases) {
    it.each([0, 1, 2])(`${definition.createDraft().title}: conclui ${stepCount} etapas escolhendo alternativas de índice %i`, optionIndex => {
      const draft = definition.createDraft()
      expect(validateDraft(draft)).toBeNull()
      expect(draft.reviewed).toBe(false)
      expect(validateDraft(draft, true)).toMatch(/revisão/)
      expect(validateDraft({ ...draft, reviewed: true }, true)).toBeNull()
      expect(draft.steps).toHaveLength(stepCount)
      expect(draft.steps.filter(step => step.type === 'decision')).toHaveLength(decisionCount)
      const student = demoStudents[draft.course === 'nursing' ? 2 : 5]
      local.loginLocal(student.email)
      local.localSetCourse(draft.course)
      const assignment = local.localStudentWorkspace().assignments.find(item => item.id === definition.assignmentId)!
      expect(assignment).toMatchObject({ stepCount, expectedDecisions: decisionCount, caseId: definition.caseId })
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
          expect(visited).toHaveLength(stepCount)
          break
        }
        step = local.localVisibleStep(definition.caseId, advanced.currentStepKey)
      }
      const debrief = local.localStudentDebrief(session.sessionId)
      expect(debrief.decisions).toHaveLength(decisionCount)
      expect(debrief.summary).toMatchObject({ scoreTotal: expectedScore, decisionCount })
      expect(debrief.references).toEqual(definition.references)
      expect(debrief.references.every(reference => reference.url?.startsWith('https://'))).toBe(true)
      expect(local.localStudentWorkspace().attempts.find(item => item.id === session.sessionId)?.status).toBe('completed')
      local.loginLocal(demoTeacher.email, 'teacher')
      expect(local.localTeacherDebrief(session.sessionId).debrief).toEqual(debrief)
    })
  }

  it('instala os dois pacotes uma única vez em dados anteriores aos roteiros', () => {
    local.loginLocal(demoTeacher.email, 'teacher')
    const prior = JSON.parse(localStorage.getItem(local.localStoreKey)!)
    const definitions = cases.map(item => item.definition)
    prior.cases = prior.cases.filter((item: { id: string }) => !definitions.some(definition => definition.caseId === item.id))
    prior.assignments = prior.assignments.filter((item: { id: string }) => !definitions.some(definition => definition.assignmentId === item.id))
    delete prior.contentPacks
    prior.sessions[0].feedback = 'Devolutiva que precisa permanecer.'
    prior.assignments[0].status = 'closed'
    localStorage.setItem(local.localStoreKey, JSON.stringify(prior))
    local.localTeacherWorkspace()
    const upgraded = JSON.parse(localStorage.getItem(local.localStoreKey)!)
    expect(upgraded.sessions).toEqual(prior.sessions)
    expect(upgraded.enrollments).toEqual(prior.enrollments)
    expect(upgraded.cases).toHaveLength(prior.cases.length + definitions.length)
    expect(upgraded.assignments).toHaveLength(prior.assignments.length + definitions.length)
    expect(upgraded.assignments[0].status).toBe('closed')
    const definition = extendedDemoCaseDefinitions[0]
    local.localCloseAssignment(definition.assignmentId, 'closed')
    local.localArchiveCase(definition.caseId)
    const after = local.localTeacherWorkspace()
    expect(after.cases.filter(item => item.id === definition.caseId)).toHaveLength(1)
    expect(after.cases.find(item => item.id === definition.caseId)?.status).toBe('archived')
    expect(after.assignments.find(item => item.id === definition.assignmentId)?.status).toBe('closed')
  })

  it('acrescenta três casos públicos por curso em dados com o primeiro pacote instalado', () => {
    local.loginLocal(demoTeacher.email, 'teacher')
    const prior = JSON.parse(localStorage.getItem(local.localStoreKey)!)
    const definitions = largePracticeCasePack.definitions
    prior.contentPacks = [extendedDemoPack]
    prior.cases = prior.cases.filter((item: { id: string }) => !definitions.some(definition => definition.caseId === item.id))
    prior.assignments = prior.assignments.filter((item: { id: string }) => !definitions.some(definition => definition.assignmentId === item.id))
    const legacy = prior.cases.find((item: { id: string }) => item.id === extendedDemoCaseDefinitions[0].caseId)
    legacy.status = 'archived'
    legacy.draft.title = 'Caso anterior arquivado'
    prior.sessions[0].feedback = 'Devolutiva preservada.'
    localStorage.setItem(local.localStoreKey, JSON.stringify(prior))

    const workspace = local.localTeacherWorkspace()
    const upgraded = JSON.parse(localStorage.getItem(local.localStoreKey)!)
    expect(upgraded.contentPacks).toEqual([extendedDemoPack, largePracticeCasePack.id])
    expect(upgraded.cases.slice(0, prior.cases.length)).toEqual(prior.cases)
    expect(upgraded.assignments.slice(0, prior.assignments.length)).toEqual(prior.assignments)
    expect(upgraded.sessions).toEqual(prior.sessions)
    expect(upgraded.enrollments).toEqual(prior.enrollments)
    expect(workspace.cases).toHaveLength(prior.cases.length + 6)
    expect(workspace.assignments).toHaveLength(prior.assignments.length + 6)
    expect(local.localTeacherWorkspace()).toEqual(workspace)

    local.loginLocal('aluno.sem.turma@osler.demo')
    for (const course of ['nursing', 'clinical_analysis'] as const) {
      local.localSetCourse(course)
      const catalogue = local.localPublicPractice(course)
      const newCases = catalogue.cases.filter(item => definitions.some(definition => definition.caseId === item.id))
      expect(newCases).toHaveLength(3)
      expect(newCases.every(item => item.course === course && item.stepCount === 12 && item.expectedDecisions === 9)).toBe(true)
      expect(local.localStudentWorkspace().classrooms).toHaveLength(0)
      for (const item of newCases) {
        const session = local.localStart(item.id)
        expect(session.caseId).toBe(item.id)
      }
    }
  })
})
