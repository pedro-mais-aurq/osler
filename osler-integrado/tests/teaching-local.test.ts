// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as local from '../src/features/teaching/localStore'
import {
  demoNursingCase,
  demoStudents,
  demoTeacher,
} from '../src/features/teaching/demoFixtures'
import {
  newCaseDraft,
  validateDraft,
} from '../src/features/teaching/validation'
import { createId } from '../src/lib/createId'

beforeEach(() => localStorage.clear())
describe('sala de aula local', () => {
  it('percorre autoria, turma, vínculo, decisão idempotente e debriefing com devolutiva', () => {
    local.loginLocal(demoTeacher.email, 'teacher')
    local.localSaveClassroom({
      name: 'Turma de integração',
      course: 'nursing',
      description: 'Teste',
      term: '2026',
    })
    const classroom = local
      .localTeacherWorkspace()
      .classrooms.find((c) => c.name === 'Turma de integração')!
    local.localEnroll(classroom.id, [
      '  ALUNO.NOVO@EXEMPLO.COM  ',
      'aluno.novo@exemplo.com',
    ])
    expect(
      local
        .localTeacherWorkspace()
        .enrollments.filter((e) => e.classroomId === classroom.id),
    ).toHaveLength(1)
    const draft = demoNursingCase()
    draft.reviewed = true
    const caseId = local.localSaveCase(draft, undefined, true)
    local.localAssign(classroom.id, caseId, 'Atividade de integração', null)
    const assignment = local
      .localTeacherWorkspace()
      .assignments.find((a) => a.classroomId === classroom.id)!
    local.loginLocal('aluno.novo@exemplo.com')
    expect(local.localStudentWorkspace().classrooms.map((c) => c.id)).toEqual([
      classroom.id,
    ])
    expect(JSON.stringify(local.localStudentWorkspace())).not.toContain(
      'classification',
    )
    local.localSetCourse('nursing')
    const initial = local.localStart(caseId, assignment.id)
    expect(local.localStart(caseId, assignment.id).sessionId).toBe(
      initial.sessionId,
    )
    let step = local.localVisibleStep(caseId, initial.currentStepKey)
    let count = 0
    for (;;) {
      if (step.type === 'decision') {
        const decision = local.localRecord(
          initial.sessionId,
          step.id,
          step.options[0].id,
        )
        expect(
          local.localRecord(initial.sessionId, step.id, step.options[0].id)
            .replayed,
        ).toBe(true)
        expect(
          local.localStart(caseId, assignment.id).recordedDecision
            ?.selectedOptionId,
        ).toBe(step.options[0].id)
        expect(decision.scoreTotal).toBe(++count * 2)
      }
      const advanced = local.localAdvance(initial.sessionId, step.id)
      expect(local.localAdvance(initial.sessionId, step.id).replayed).toBe(true)
      if (advanced.status === 'completed') break
      step = local.localVisibleStep(caseId, advanced.currentStepKey)
    }
    const debrief = local.localStudentDebrief(initial.sessionId)
    expect(debrief.summary.scoreTotal).toBe(4)
    expect(debrief.decisions).toHaveLength(2)
    local.loginLocal(demoTeacher.email, 'teacher')
    expect(local.localTeacherDebrief(initial.sessionId).email).toBe(
      'aluno.novo@exemplo.com',
    )
    local.localSaveFeedback(initial.sessionId, 'Vamos retomar a comunicação.')
    local.loginLocal('aluno.novo@exemplo.com')
    expect(local.localStudentWorkspace().attempts[0].feedback).toBe(
      'Vamos retomar a comunicação.',
    )
    expect(() => local.localTeacherWorkspace()).toThrow()
  })
  it('isola professores e preserva casos e históricos publicados', () => {
    local.loginLocal(demoTeacher.email, 'teacher')
    const w = local.localTeacherWorkspace(),
      published = w.cases.find((c) => c.status === 'published')!,
      completed = w.attempts.find((a) => a.status === 'completed')!
    expect(() => local.localSaveCase(published.draft, published.id)).toThrow(
      /preservados/,
    )
    local.localArchiveCase(published.id)
    expect(local.localTeacherDebrief(completed.id).debrief.sessionId).toBe(
      completed.id,
    )
    local.loginLocal('outro.professor@exemplo.com', 'teacher')
    expect(local.localTeacherWorkspace().classrooms).toHaveLength(0)
    expect(() => local.localTeacherDebrief(completed.id)).toThrow()
    expect(() =>
      local.localEnroll(w.classrooms[0].id, ['invasor@exemplo.com']),
    ).toThrow()
    local.loginLocal(demoStudents[0].email)
    expect(() =>
      local.localStudentDebrief(
        w.attempts.find((a) => a.email !== demoStudents[0].email)!.id,
      ),
    ).toThrow()
  })
  it('revoga acesso, bloqueia atividades encerradas e não revive vínculo no login', () => {
    local.loginLocal(demoTeacher.email, 'teacher')
    const w = local.localTeacherWorkspace(),
      enrollment = w.enrollments.find(
        (e) => e.email === demoStudents[2].email,
      )!,
      assignment = w.assignments.find(
        (a) => a.classroomId === enrollment.classroomId,
      )!
    local.loginLocal(demoStudents[2].email)
    local.localSetCourse('nursing')
    const session = local.localStart(assignment.caseId, assignment.id)
    local.loginLocal(demoTeacher.email, 'teacher')
    local.localCloseAssignment(assignment.id, 'closed')
    local.loginLocal(demoStudents[2].email)
    expect(() =>
      local.localAdvance(session.sessionId, session.currentStepId),
    ).toThrow()
    local.loginLocal(demoTeacher.email, 'teacher')
    local.localCloseAssignment(assignment.id, 'open')
    local.localRevoke(enrollment.id)
    local.loginLocal(demoStudents[2].email)
    expect(local.localStudentWorkspace().assignments).toHaveLength(0)
    expect(() => local.localStart(assignment.caseId, assignment.id)).toThrow()
    expect(local.localAbandon(session.sessionId).status).toBe('abandoned')
  })
  it('mantém tentativas distintas do mesmo caso em duas atividades', () => {
    local.loginLocal(demoTeacher.email, 'teacher')
    const w = local.localTeacherWorkspace(),
      first = w.assignments.find((a) => a.caseId === w.cases[0].id)!
    local.localAssign(first.classroomId, first.caseId, 'Outro encontro', null)
    const second = local.localTeacherWorkspace().assignments[0]
    local.loginLocal(demoStudents[2].email)
    local.localSetCourse('nursing')
    expect(local.localStart(first.caseId, first.id).sessionId).not.toBe(
      local.localStart(second.caseId, second.id).sessionId,
    )
  })
  it('rejeita ciclos, publicação sem revisão e cadastro parcial de e-mails inválidos', () => {
    const draft = demoNursingCase()
    expect(validateDraft(draft, true)).toMatch(/revisão/)
    draft.steps[1].options[0].nextStepKey = draft.steps[0].key
    expect(validateDraft(draft)).toMatch(/posterior/)
    local.loginLocal(demoTeacher.email, 'teacher')
    const w = local.localTeacherWorkspace(),
      count = w.enrollments.length
    expect(() =>
      local.localEnroll(w.classrooms[0].id, ['novo@exemplo.com', 'inválido']),
    ).toThrow()
    expect(local.localTeacherWorkspace().enrollments).toHaveLength(count)
  })
  it('salva rascunhos incompletos e exige conteúdo completo para publicar', () => {
    local.loginLocal(demoTeacher.email, 'teacher')
    const draft = { ...newCaseDraft(), title: 'Em elaboração' }
    expect(validateDraft(draft)).toBeNull()
    expect(local.localSaveCase(draft)).toBeTruthy()
    expect(() => local.localSaveCase(draft, undefined, true)).toThrow()
  })
  it('gera UUIDs mesmo em uma prévia HTTP sem randomUUID', () => {
    const original = crypto.randomUUID
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: undefined,
    })
    expect(createId()).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    )
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: original,
    })
  })
  it('não cria um cliente online no modo de demonstração', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'local')
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'fake-publishable')
    vi.resetModules()
    const { supabase } = await import('../src/lib/supabase')
    expect(supabase).toBeNull()
    vi.unstubAllEnvs()
    vi.resetModules()
  })
})
