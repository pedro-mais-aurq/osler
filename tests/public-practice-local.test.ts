// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import * as local from '../src/features/teaching/localStore'
import { demoNursingCase, demoTeacher } from '../src/features/teaching/demoFixtures'
import { extendedDemoCaseDefinitions } from '../src/features/teaching/extendedDemoCases'
import { newCaseDraft, validateDraft } from '../src/features/teaching/validation'

const publicCase = extendedDemoCaseDefinitions[0]
beforeEach(() => localStorage.clear())

describe('prática pública, visibilidade e participação opcional', () => {
  it('permite concluir um caso público sem matrícula e mantém a tentativa fora do acompanhamento docente', () => {
    local.loginLocal('independente@osler.demo')
    local.localSetCourse('nursing')
    expect(local.localStudentWorkspace().classrooms).toHaveLength(0)
    const catalogue = local.localPublicPractice('nursing')
    expect(catalogue.cases.map(item => item.id)).toContain(publicCase.caseId)
    expect(JSON.stringify(catalogue)).not.toContain('classification')
    expect(JSON.stringify(catalogue)).not.toContain('feedback')
    const initial = local.localStart(publicCase.caseId)
    expect(local.localStart(publicCase.caseId).sessionId).toBe(initial.sessionId)
    let step = local.localVisibleStep(publicCase.caseId, initial.currentStepKey)
    for (let index = 0; index < 7; index++) {
      if (step.type === 'decision') local.localRecord(initial.sessionId, step.id, step.options[0].id)
      const advanced = local.localAdvance(initial.sessionId, step.id)
      if (advanced.status === 'completed') break
      step = local.localVisibleStep(publicCase.caseId, advanced.currentStepKey)
    }
    expect(local.localStudentDebrief(initial.sessionId).summary).toMatchObject({ scoreTotal: 10, decisionCount: 5 })
    expect(local.localPublicPractice('nursing').attempts[0]).toMatchObject({ id: initial.sessionId, assignmentId: null, status: 'completed', caseId: publicCase.caseId })
    expect(local.localStudentWorkspace().attempts).toHaveLength(0)
    local.loginLocal(demoTeacher.email, 'teacher')
    expect(local.localTeacherWorkspace().attempts.map(item => item.id)).not.toContain(initial.sessionId)
    expect(() => local.localTeacherDebrief(initial.sessionId)).toThrow()
    expect(() => local.localSaveFeedback(initial.sessionId, 'Não autorizado')).toThrow()
  })

  it('não expõe casos privados ou rascunhos públicos ao aluno sem turma', () => {
    local.loginLocal(demoTeacher.email, 'teacher')
    const draft = { ...demoNursingCase(), reviewed: true, visibility: 'private' as const }
    const privateId = local.localSaveCase(draft, undefined, true)
    const draftId = local.localSaveCase({ ...draft, title: 'Rascunho público', visibility: 'public' })
    local.loginLocal('sem.turma@osler.demo')
    local.localSetCourse('nursing')
    const catalogue = local.localPublicPractice('nursing')
    expect(catalogue.cases.some(item => [privateId, draftId].includes(item.id))).toBe(false)
    expect(() => local.localSimulationCase(privateId, 'nursing')).toThrow()
    expect(() => local.localVisibleStep(privateId, 'acolhimento')).toThrow()
    expect(() => local.localStart(privateId)).toThrow()
    expect(() => local.localStart(draftId)).toThrow()
    expect(newCaseDraft().visibility).toBe('private')
    expect(validateDraft({ ...draft, visibility: 'invalid' as 'public' })).toMatch(/visibilidade/)
  })

  it('entra por código de forma idempotente, mantém e-mail próprio e respeita revogação e arquivamento', () => {
    local.loginLocal(demoTeacher.email, 'teacher')
    const classroom = local.localTeacherWorkspace().classrooms[0]
    expect(classroom.joinCode).toMatch(/^OSLER-[A-F0-9]{16}$/)
    local.loginLocal('novo.membro@osler.demo')
    expect(() => local.localJoinClassroom('inválido')).toThrow(/inválido/)
    expect(local.localJoinClassroom(' ' + classroom.joinCode!.toLowerCase() + ' ').id).toBe(classroom.id)
    expect(local.localJoinClassroom(classroom.joinCode!).joinCode).toBeUndefined()
    expect(local.localStudentWorkspace().classrooms[0].joinCode).toBeUndefined()
    local.loginLocal(demoTeacher.email, 'teacher')
    const memberships = local.localTeacherWorkspace().enrollments.filter(item => item.classroomId === classroom.id && item.email === 'novo.membro@osler.demo')
    expect(memberships).toHaveLength(1)
    local.localRevoke(memberships[0].id)
    local.loginLocal('novo.membro@osler.demo')
    expect(() => local.localJoinClassroom(classroom.joinCode!)).toThrow(/revogado/)
    local.loginLocal(demoTeacher.email, 'teacher')
    local.localArchiveClassroom(classroom.id, true)
    local.loginLocal('outro.membro@osler.demo')
    expect(() => local.localJoinClassroom(classroom.joinCode!)).toThrow(/inválido/)
  })

  it('separa tentativas individuais e de turma mesmo no mesmo caso público', () => {
    local.loginLocal(demoTeacher.email, 'teacher')
    const classroom = local.localTeacherWorkspace().classrooms.find(item => item.course === 'nursing')!
    local.loginLocal('ambos@osler.demo')
    local.localSetCourse('nursing')
    const independent = local.localStart(publicCase.caseId)
    local.localJoinClassroom(classroom.joinCode!)
    const assigned = local.localStart(publicCase.caseId, publicCase.assignmentId)
    expect(assigned.sessionId).not.toBe(independent.sessionId)
    expect(local.localPublicPractice('nursing').attempts.map(item => item.id)).toEqual([independent.sessionId])
    expect(local.localStudentWorkspace().attempts.map(item => item.id)).toEqual([assigned.sessionId])
    local.loginLocal('outra.conta@osler.demo')
    expect(local.localPublicPractice('nursing').attempts).toHaveLength(0)
    expect(() => local.localStudentDebrief(independent.sessionId)).toThrow()
  })
})
