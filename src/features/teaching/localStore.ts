import { createId } from '../../lib/createId'
import type { SimulationDebrief, DebriefDecision } from '../debrief/types'
import type {
  AbandonedSimulationSession,
  AdvanceSimulationResult,
  CaseStep,
  RecordedSimulationDecision,
  SimulationCase,
  SimulationSessionSnapshot,
  SimulationTransition,
} from '../simulation/types'
import type { StudentCourse } from '../../types/database'
import {
  demoLabCase,
  demoNursingCase,
  demoStudents,
  demoTeacher,
} from './demoFixtures'
import type {
  Assignment,
  AttemptSummary,
  CaseDraft,
  Classroom,
  Enrollment,
  PortalIdentity,
  PublicPracticeWorkspace,
  StudentWorkspace,
  TeacherWorkspace,
  TeachingCase,
} from './types'
import { normalizeEmail, validEmail, validateDraft } from './validation'
import { practiceCaseDefinitions, practiceCasePacks } from './practiceCasePacks'

export const localStoreKey = 'osler.classroom.demo.v1'
const identityKey = 'osler.classroom.identity.v1'
export const portalChangeEvent = 'osler:portal-change'
interface LocalAttempt {
  id: string
  assignmentId: string | null
  userId: string
  caseId: string
  status: 'in_progress' | 'completed' | 'abandoned'
  stepIndex: number
  scoreTotal: number
  startedAt: string
  completedAt: string | null
  decisions: RecordedSimulationDecision[]
  advances: Record<string, AdvanceSimulationResult>
  feedback: string
}
interface LocalStore extends TeacherWorkspace {
  version: 1
  identities: PortalIdentity[]
  courses: Record<string, StudentCourse>
  sessions: LocalAttempt[]
  contentPacks?: string[]
}
const now = () => new Date().toISOString()
const id = () => createId()
function fail(
  message = 'Este recurso não está disponível para esta conta.',
): never {
  throw new Error(message)
}
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

function summary(c: TeachingCase) {
  return {
    id: c.id,
    slug: `caso-${c.id}`,
    title: c.draft.title,
    description: c.draft.description,
    educationalObjective: c.draft.objective,
    status: c.status,
  }
}
function stepId(c: TeachingCase, index: number) {
  return `${c.id.slice(0, 24)}${String(index + 1).padStart(12, '0')}`
}
function visibleStep(c: TeachingCase, index: number): CaseStep {
  const s = c.draft.steps[index] ?? fail('Etapa indisponível.')
  const base = {
    id: stepId(c, index),
    caseId: c.id,
    position: index + 1,
    stepKey: s.key,
    title: s.title,
    content: { body: s.body, observations: s.observations },
    presentationState: s.presentationState,
  }
  return s.type === 'decision'
    ? {
        ...base,
        type: 'decision',
        options: s.options.map((o) => ({ id: o.id, label: o.label })),
      }
    : { ...base, type: 'information' }
}
function transitionFor(
  c: TeachingCase,
  index: number,
  optionId: string | null,
): SimulationTransition {
  const step = c.draft.steps[index] ?? fail()
  const option =
    optionId === null
      ? null
      : (step.options.find((o) => o.id === optionId) ??
        fail('Alternativa inválida.'))
  if ((step.type === 'decision') !== (option !== null))
    fail('A etapa não aceita essa ação.')
  const nextIndex =
    option && !['next', 'complete'].includes(option.nextStepKey)
      ? c.draft.steps.findIndex((s) => s.key === option.nextStepKey)
      : index + 1
  const completed =
    option?.nextStepKey === 'complete' || nextIndex >= c.draft.steps.length
  if (!completed && nextIndex <= index) fail('Destino inválido.')
  return {
    evaluation: option
      ? {
          classification: option.classification,
          scoreDelta: option.scoreDelta,
          feedback: option.feedback,
          consequence: option.consequence || null,
        }
      : null,
    nextStepKey: completed ? null : c.draft.steps[nextIndex].key,
    completed,
    presentationState:
      option?.presentationState ??
      (completed ? null : c.draft.steps[nextIndex].presentationState),
  }
}

function addPracticeCasePacks(store: LocalStore): boolean {
  const installedPacks = store.contentPacks ?? []
  const pendingPacks = practiceCasePacks.filter(pack => !installedPacks.includes(pack.id))
  if (pendingPacks.length === 0) return false

  const createdAt = now()
  for (const definition of pendingPacks.flatMap(pack => pack.definitions)) {
    const draft: CaseDraft = { ...definition.createDraft(), visibility: 'public' }
    // Fixed content identities make the upgrade idempotent. Existing edits,
    // archived resources, decisions and teacher feedback are never replaced.
    if (!store.cases.some(item => item.id === definition.caseId)) {
      store.cases.push({ id: definition.caseId, teacherId: demoTeacher.userId, status: 'published', draft, createdAt })
    }
    const classroom = store.classrooms.find(item => item.teacherId === demoTeacher.userId && item.course === draft.course && !item.archived)
      ?? store.classrooms.find(item => item.teacherId === demoTeacher.userId && item.course === draft.course)
    if (classroom && !store.assignments.some(item => item.id === definition.assignmentId)) {
      store.assignments.push({ id: definition.assignmentId, classroomId: classroom.id, caseId: definition.caseId, title: definition.assignmentTitle, dueAt: null, status: 'open', createdAt })
    }
  }
  store.contentPacks = [...installedPacks, ...pendingPacks.map(pack => pack.id)]
  return true
}

function addParticipationDefaults(store: LocalStore): boolean {
  let changed = false
  for (const item of store.cases) {
    if (item.draft.visibility === undefined) {
      item.draft.visibility = practiceCaseDefinitions.some(definition => definition.caseId === item.id) ? 'public' : 'private'
      changed = true
    }
  }
  for (const classroom of store.classrooms) {
    if (!classroom.joinCode) {
      classroom.joinCode = 'OSLER-' + id().replaceAll('-', '').slice(0, 16).toUpperCase()
      changed = true
    }
  }
  return changed
}

function seed(): LocalStore {
  const createdAt = now()
  const classroom: Classroom = {
    id: id(),
    teacherId: demoTeacher.userId,
    name: 'Enfermagem · Turma 2026.2',
    course: 'nursing',
    description: 'Prática de acolhimento, segurança e comunicação.',
    term: '2º semestre de 2026',
    archived: false,
    createdAt,
  }
  const lab: Classroom = {
    ...classroom,
    id: id(),
    name: 'Análises clínicas · Turma A',
    course: 'clinical_analysis',
    description: 'Do recebimento da amostra à comunicação do resultado.',
  }
  const nursingCase: TeachingCase = {
    id: id(),
    teacherId: demoTeacher.userId,
    status: 'published',
    draft: demoNursingCase(),
    createdAt,
  }
  const labCase: TeachingCase = {
    id: id(),
    teacherId: demoTeacher.userId,
    status: 'published',
    draft: demoLabCase(),
    createdAt,
  }
  const draft: TeachingCase = {
    ...nursingCase,
    id: id(),
    status: 'draft',
    draft: { ...demoNursingCase(), title: 'Acolhimento · próximo encontro' },
  }
  const assignments: Assignment[] = [nursingCase, labCase].map((c, i) => ({
    id: id(),
    classroomId: i === 0 ? classroom.id : lab.id,
    caseId: c.id,
    title:
      i === 0
        ? '01 · Segurança no acolhimento'
        : '01 · Rastreabilidade da amostra',
    dueAt: new Date(Date.now() + 5 * 86400000).toISOString(),
    status: 'open',
    createdAt,
  }))
  const enrollments: Enrollment[] = demoStudents.map((student, i) => ({
    id: id(),
    classroomId: i < 4 ? classroom.id : lab.id,
    email: student.email,
    studentId: student.userId,
    status: 'active',
    createdAt,
  }))
  enrollments.push({
    id: id(),
    classroomId: classroom.id,
    email: 'novo.aluno@osler.demo',
    studentId: null,
    status: 'invited',
    createdAt,
  })
  const store: LocalStore = {
    version: 1,
    classrooms: [classroom, lab],
    enrollments,
    cases: [nursingCase, labCase, draft],
    assignments,
    attempts: [],
    sessions: [],
    identities: [demoTeacher, ...demoStudents],
    courses: Object.fromEntries(
      demoStudents.map((s, i) => [
        s.userId,
        i < 4 ? 'nursing' : 'clinical_analysis',
      ]),
    ),
  }
  for (const [i, student] of demoStudents.entries()) {
    if ([2, 3, 5].includes(i)) continue
    const c = i < 4 ? nursingCase : labCase
    const session: LocalAttempt = {
      id: id(),
      userId: student.userId,
      caseId: c.id,
      assignmentId: assignments[i < 4 ? 0 : 1].id,
      status: 'completed',
      stepIndex: c.draft.steps.length - 1,
      scoreTotal: 0,
      startedAt: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
      completedAt: new Date(Date.now() - (i + 1) * 3000000).toISOString(),
      decisions: [],
      advances: {},
      feedback:
        i === 0
          ? 'Boa organização do relato. No próximo encontro, vamos discutir quais observações priorizar.'
          : '',
    }
    c.draft.steps.forEach((s, index) => {
      if (s.type !== 'decision') return
      const option = s.options[i === 1 ? s.options.length - 1 : 0]
      const t = transitionFor(c, index, option.id)
      if (!t.evaluation) return
      session.scoreTotal += t.evaluation.scoreDelta
      session.decisions.push({
        actionId: id(),
        sessionId: session.id,
        stepId: stepId(c, index),
        selectedOptionId: option.id,
        transition: { ...t, evaluation: t.evaluation },
        scoreTotal: session.scoreTotal,
        decisionCount: session.decisions.length + 1,
        createdAt: session.startedAt,
        replayed: false,
      })
    })
    store.sessions.push(session)
  }
  addPracticeCasePacks(store)
  addParticipationDefaults(store)
  return store
}
function getStore(): LocalStore {
  const raw = localStorage.getItem(localStoreKey)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as LocalStore
      if (parsed.version === 1 && Array.isArray(parsed.sessions)) {
        const addedCases = addPracticeCasePacks(parsed)
        const addedParticipation = addParticipationDefaults(parsed)
        if (addedCases || addedParticipation) save(parsed)
        return parsed
      }
    } catch {
      /* recover a damaged demo only */
    }
  }
  const store = seed()
  save(store)
  return store
}
function save(store: LocalStore) {
  localStorage.setItem(localStoreKey, JSON.stringify(store))
}
export function localIdentity(): PortalIdentity | null {
  const raw = localStorage.getItem(identityKey)
  if (!raw) return null
  try {
    const userId = JSON.parse(raw) as string
    return getStore().identities.find((u) => u.userId === userId) ?? null
  } catch {
    return null
  }
}
function identity(role?: PortalIdentity['role']) {
  const u = localIdentity() ?? fail('Entre em uma conta de demonstração.')
  if (role && u.role !== role) fail()
  return u
}
export function loginLocal(
  email: string,
  role: 'student' | 'teacher' = 'student',
) {
  const normalized = normalizeEmail(email)
  if (!validEmail(normalized)) fail('Informe um e-mail válido.')
  const store = getStore()
  let user = store.identities.find((u) => u.email === normalized)
  if (!user) {
    user = {
      userId: id(),
      email: normalized,
      displayName: normalized.split('@')[0],
      role,
    }
    store.identities.push(user)
  }
  user.role = role
  store.enrollments
    .filter((e) => e.email === normalized && e.status !== 'revoked')
    .forEach((e) => {
      e.studentId = user.userId
      e.status = 'active'
    })
  save(store)
  localStorage.setItem(identityKey, JSON.stringify(user.userId))
  window.dispatchEvent(new Event(portalChangeEvent))
  return user
}
export function logoutLocal() {
  localStorage.removeItem(identityKey)
  window.dispatchEvent(new Event(portalChangeEvent))
}
export function resetLocalDemo() {
  localStorage.removeItem(localStoreKey)
  logoutLocal()
  getStore()
}
function ownedClassroom(store: LocalStore, classroomId: string) {
  const teacher = identity('teacher')
  return (
    store.classrooms.find(
      (c) => c.id === classroomId && c.teacherId === teacher.userId,
    ) ?? fail()
  )
}
function studentMember(
  store: LocalStore,
  classroomId: string,
  student: PortalIdentity,
) {
  return store.enrollments.some(
    (e) =>
      e.classroomId === classroomId &&
      e.studentId === student.userId &&
      e.email === student.email &&
      e.status === 'active',
  )
}
function authorizeAssignment(
  store: LocalStore,
  assignmentId: string,
  student: PortalIdentity,
  caseId: string,
) {
  const assignment =
    store.assignments.find(
      (a) =>
        a.id === assignmentId && a.caseId === caseId && a.status === 'open',
    ) ?? fail('Esta atividade não está aberta para esta conta.')
  const classroom =
    store.classrooms.find(
      (c) => c.id === assignment.classroomId && !c.archived,
    ) ?? fail('Turma arquivada.')
  if (!studentMember(store, classroom.id, student)) fail()
  return assignment
}
function attemptSummary(store: LocalStore, s: LocalAttempt): AttemptSummary {
  return {
    id: s.id,
    assignmentId: s.assignmentId,
    caseId: s.caseId,
    studentId: s.userId,
    email: store.identities.find((u) => u.userId === s.userId)?.email ?? '',
    caseTitle:
      store.cases.find((c) => c.id === s.caseId)?.draft.title ?? 'Caso',
    status: s.status,
    scoreTotal: s.scoreTotal,
    decisionCount: s.decisions.length,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    feedback: s.feedback,
  }
}
export function localTeacherWorkspace(): TeacherWorkspace {
  const store = getStore(),
    teacher = identity('teacher')
  const classrooms = store.classrooms.filter(
    (c) => c.teacherId === teacher.userId,
  )
  const ids = new Set(classrooms.map((c) => c.id))
  const assignments = store.assignments.filter((a) => ids.has(a.classroomId))
  const assignmentIds = new Set(assignments.map((a) => a.id))
  return copy({
    classrooms,
    enrollments: store.enrollments.filter((e) => ids.has(e.classroomId)),
    cases: store.cases.filter((c) => c.teacherId === teacher.userId),
    assignments,
    attempts: store.sessions
      .filter((s) => s.assignmentId !== null && assignmentIds.has(s.assignmentId))
      .map((s) => attemptSummary(store, s)),
  })
}
export function localStudentWorkspace(): StudentWorkspace {
  const store = getStore(),
    student = identity('student')
  const classrooms = store.classrooms.filter(
    (c) => !c.archived && studentMember(store, c.id, student),
  )
  const assignments = store.assignments
    .filter((a) => classrooms.some((c) => c.id === a.classroomId))
    .map((a) => {
      const c = store.cases.find((c) => c.id === a.caseId) ?? fail()
      const classroom = classrooms.find((c) => c.id === a.classroomId) ?? fail()
      return {
        ...a,
        classroomName: classroom.name,
        course: classroom.course,
        caseTitle: c.draft.title,
        description: c.draft.description,
        objective: c.draft.objective,
        stepCount: c.draft.steps.length,
        expectedDecisions: c.draft.steps.filter(step => step.type === 'decision').length,
      }
    })
  return copy({
    classrooms: classrooms.map(({ joinCode: _joinCode, ...classroom }) => classroom),
    assignments,
    attempts: store.sessions
      .filter((s) => s.userId === student.userId && s.assignmentId !== null)
      .map((s) => attemptSummary(store, s)),
  })
}

export function localPublicPractice(course: StudentCourse): PublicPracticeWorkspace {
  const student = identity('student'), store = getStore()
  return copy({
    cases: store.cases.filter(item => item.status === 'published' && item.draft.visibility === 'public' && item.draft.course === course).map(item => ({
      id: item.id, title: item.draft.title, course: item.draft.course,
      description: item.draft.description, objective: item.draft.objective,
      stepCount: item.draft.steps.length, expectedDecisions: item.draft.steps.filter(step => step.type === 'decision').length,
    })),
    attempts: store.sessions.filter(session => session.userId === student.userId && session.assignmentId === null && store.cases.find(item => item.id === session.caseId)?.draft.course === course).map(session => attemptSummary(store, session)),
  })
}

export function localJoinClassroom(code: string): Classroom {
  const student = identity('student'), store = getStore()
  const normalized = code.trim().toUpperCase()
  const classroom = store.classrooms.find(item => item.joinCode === normalized && !item.archived)
  if (!classroom) fail('Código de turma inválido ou indisponível. Confira com o professor.')
  const enrollment = store.enrollments.find(item => item.classroomId === classroom.id && item.email === student.email)
  if (enrollment?.status === 'revoked') fail('Seu acesso foi revogado. Peça ao professor para liberar sua entrada novamente.')
  if (enrollment) { enrollment.studentId = student.userId; enrollment.status = 'active' }
  else store.enrollments.push({ id: id(), classroomId: classroom.id, email: student.email, studentId: student.userId, status: 'active', createdAt: now() })
  save(store)
  const { joinCode: _joinCode, ...result } = classroom
  return copy(result)
}
export function localSaveClassroom(
  input: Pick<Classroom, 'name' | 'course' | 'description' | 'term'>,
  classroomId?: string,
) {
  const store = getStore(),
    teacher = identity('teacher')
  if (
    !input.name.trim() ||
    input.name.length > 120 ||
    input.description.length > 2000 ||
    input.term.length > 120
  )
    fail('Revise o nome, período e descrição da turma.')
  if (!['nursing', 'clinical_analysis'].includes(input.course))
    fail('Curso inválido.')
  if (classroomId) {
    const classroom = ownedClassroom(store, classroomId)
    if (
      input.course !== classroom.course &&
      store.assignments.some((a) => a.classroomId === classroomId)
    )
      fail('O curso de uma turma com atividades não pode ser alterado.')
    Object.assign(classroom, input)
  } else
    store.classrooms.unshift({
      ...input,
      id: id(),
      teacherId: teacher.userId,
      archived: false,
      createdAt: now(),
      joinCode: 'OSLER-' + id().replaceAll('-', '').slice(0, 16).toUpperCase(),
    })
  save(store)
}
export function localArchiveClassroom(classroomId: string, archived: boolean) {
  const store = getStore()
  ownedClassroom(store, classroomId).archived = archived
  save(store)
}
export function localEnroll(classroomId: string, emails: string[]) {
  const store = getStore(),
    classroom = ownedClassroom(store, classroomId)
  if (classroom.archived) fail('Reabra a turma antes de adicionar alunos.')
  const normalized = [...new Set(emails.map(normalizeEmail))]
  if (
    !normalized.length ||
    normalized.length > 100 ||
    normalized.some((e) => !validEmail(e))
  )
    fail('Informe até 100 e-mails válidos.')
  for (const email of normalized) {
    const student = store.identities.find(
      (u) => u.email === email && u.role === 'student',
    )
    const existing = store.enrollments.find(
      (e) => e.classroomId === classroomId && e.email === email,
    )
    const data = {
      studentId: student?.userId ?? null,
      status: student ? ('active' as const) : ('invited' as const),
    }
    if (existing) Object.assign(existing, data)
    else
      store.enrollments.push({
        ...data,
        id: id(),
        classroomId,
        email,
        createdAt: now(),
      })
  }
  save(store)
}
export function localRevoke(enrollmentId: string) {
  const store = getStore(),
    e = store.enrollments.find((e) => e.id === enrollmentId) ?? fail()
  ownedClassroom(store, e.classroomId)
  e.status = 'revoked'
  save(store)
}
export function localSaveCase(
  draft: CaseDraft,
  caseId?: string,
  publish = false,
) {
  const store = getStore(),
    teacher = identity('teacher'),
    error = validateDraft(draft, publish)
  if (error) fail(error)
  let c = caseId
    ? (store.cases.find(
        (c) => c.id === caseId && c.teacherId === teacher.userId,
      ) ?? fail())
    : null
  if (c && c.status !== 'draft')
    fail(
      'Casos publicados são preservados. Duplique o caso para criar uma nova versão.',
    )
  if (!c) {
    c = {
      id: id(),
      teacherId: teacher.userId,
      status: 'draft',
      draft: copy({ visibility: 'private', ...draft }),
      createdAt: now(),
    }
    store.cases.unshift(c)
  }
  c.draft = copy({ visibility: 'private', ...draft })
  c.status = publish ? 'published' : 'draft'
  save(store)
  return c.id
}
export function localArchiveCase(caseId: string) {
  const store = getStore(),
    teacher = identity('teacher')
  const c =
    store.cases.find(
      (c) => c.id === caseId && c.teacherId === teacher.userId,
    ) ?? fail()
  c.status = 'archived'
  store.assignments
    .filter((a) => a.caseId === caseId)
    .forEach((a) => {
      a.status = 'closed'
    })
  save(store)
}
export function localAssign(
  classroomId: string,
  caseId: string,
  title: string,
  dueAt: string | null,
) {
  const store = getStore(),
    classroom = ownedClassroom(store, classroomId)
  const c =
    store.cases.find(
      (c) =>
        c.id === caseId &&
        c.teacherId === classroom.teacherId &&
        c.status === 'published' &&
        c.draft.course === classroom.course,
    ) ?? fail('Selecione um caso publicado do mesmo curso.')
  if (
    classroom.archived ||
    !title.trim() ||
    title.length > 160 ||
    (dueAt !== null && !Number.isFinite(Date.parse(dueAt)))
  )
    fail('Revise a atividade e a turma.')
  store.assignments.unshift({
    id: id(),
    classroomId,
    caseId: c.id,
    title,
    dueAt,
    status: 'open',
    createdAt: now(),
  })
  save(store)
}
export function localCloseAssignment(
  assignmentId: string,
  status: Assignment['status'],
) {
  const store = getStore(),
    a = store.assignments.find((a) => a.id === assignmentId) ?? fail()
  ownedClassroom(store, a.classroomId)
  if (
    status === 'open' &&
    store.cases.find((c) => c.id === a.caseId)?.status !== 'published'
  )
    fail('O caso está arquivado.')
  a.status = status
  save(store)
}
export function localStudent() {
  const student = identity('student'),
    store = getStore()
  return {
    userId: student.userId,
    role: student.role,
    course: store.courses[student.userId] ?? null,
  }
}
export function localSetCourse(course: StudentCourse) {
  const student = identity('student'),
    store = getStore()
  store.courses[student.userId] = course
  save(store)
  return course
}
function availableCase(
  store: LocalStore,
  caseId: string,
  course?: StudentCourse,
) {
  const student = identity('student')
  const c =
    store.cases.find(
      (c) =>
        c.id === caseId &&
        c.status === 'published' &&
        (!course || c.draft.course === course),
    ) ?? fail('Caso indisponível.')
  if (
    c.draft.visibility !== 'public' &&
    !store.assignments.some(
      (a) =>
        a.caseId === caseId &&
        a.status === 'open' &&
        store.classrooms.some((r) => r.id === a.classroomId && !r.archived) &&
        studentMember(store, a.classroomId, student),
    )
  )
    fail()
  return c
}
export function localResolveCase(
  course: StudentCourse,
  requestedId: string | null,
) {
  const store = getStore()
  const assignments = localStudentWorkspace().assignments.filter(
    (a) => a.course === course && a.status === 'open',
  )
  const available = store.cases.filter(item => item.status === 'published' && item.draft.course === course && (item.draft.visibility === 'public' || assignments.some(assignment => assignment.caseId === item.id)))
  const chosen = available.find(item => item.id === requestedId) ?? available[0]
  if (!chosen) return { case: null, requestedCaseAccepted: false }
  return {
    case: summary(availableCase(store, chosen.id, course)),
    requestedCaseAccepted: chosen.id === requestedId,
  }
}
export function localSimulationCase(
  caseId: string,
  course: StudentCourse,
): SimulationCase {
  const c = availableCase(getStore(), caseId, course)
  return copy({
    case: summary(c),
    patient: {
      id: c.id,
      displayName: c.draft.patientName,
      ageYears: c.draft.patientAge,
      pronouns: c.draft.pronouns,
      sexOrAnatomyContext: null,
      visualRef: null,
    },
    firstStep: visibleStep(c, 0),
  })
}
export function localVisibleStep(caseId: string, key: string) {
  const c = availableCase(getStore(), caseId),
    index = c.draft.steps.findIndex((s) => s.key === key)
  return copy(visibleStep(c, index))
}
function ownedAttempt(
  store: LocalStore,
  sessionId: string,
  requireOpen = true,
) {
  const student = identity('student'),
    s =
      store.sessions.find(
        (s) => s.id === sessionId && s.userId === student.userId,
      ) ?? fail()
  if (requireOpen) {
    if (s.assignmentId) authorizeAssignment(store, s.assignmentId, student, s.caseId)
    else if (availableCase(store, s.caseId).draft.visibility !== 'public') fail('Este caso não está disponível para prática individual.')
  }
  return s
}
export function localStart(
  caseId: string,
  assignmentId?: string | null,
): SimulationSessionSnapshot {
  const store = getStore(),
    student = identity('student'),
    c = availableCase(store, caseId)
  const scope = assignmentId ?? null
  if (scope) authorizeAssignment(store, scope, student, caseId)
  else if (c.draft.visibility !== 'public') fail('Abra o caso privado pela atividade de uma turma autorizada.')
  if (store.courses[student.userId] !== c.draft.course)
    fail('Selecione o curso da atividade.')
  let s = store.sessions.find(
    (s) =>
      s.userId === student.userId &&
      s.caseId === caseId &&
      s.assignmentId === scope &&
      s.status === 'in_progress',
  )
  const resumed = !!s
  if (!s) {
    s = {
      id: id(),
      userId: student.userId,
      caseId,
      assignmentId: scope,
      status: 'in_progress',
      stepIndex: 0,
      scoreTotal: 0,
      startedAt: now(),
      completedAt: null,
      decisions: [],
      advances: {},
      feedback: '',
    }
    store.sessions.push(s)
    save(store)
  }
  const step = visibleStep(c, s.stepIndex),
    decision = s.decisions.find((d) => d.stepId === step.id)
  return copy({
    sessionId: s.id,
    caseId,
    status: s.status,
    currentStepId: step.id,
    currentStepKey: step.stepKey,
    scoreTotal: s.scoreTotal,
    decisionCount: s.decisions.length,
    startedAt: s.startedAt,
    resumed,
    presentationState:
      decision?.transition.presentationState ?? step.presentationState,
    recordedDecision: decision
      ? {
          selectedOptionId: decision.selectedOptionId,
          transition: decision.transition,
        }
      : null,
  })
}
export function localRecord(
  sessionId: string,
  requestedStepId: string,
  optionId: string,
): RecordedSimulationDecision {
  const store = getStore(),
    s = ownedAttempt(store, sessionId),
    c = availableCase(store, s.caseId)
  const existing = s.decisions.find((d) => d.stepId === requestedStepId)
  if (existing) {
    if (existing.selectedOptionId !== optionId)
      fail('Esta etapa já tem uma decisão registrada.')
    return copy({ ...existing, replayed: true })
  }
  if (s.status !== 'in_progress' || stepId(c, s.stepIndex) !== requestedStepId)
    fail('Etapa fora da sequência atual.')
  const transition = transitionFor(c, s.stepIndex, optionId)
  if (!transition.evaluation) fail('Etapa sem decisão.')
  s.scoreTotal += transition.evaluation.scoreDelta
  const decision: RecordedSimulationDecision = {
    actionId: id(),
    sessionId,
    stepId: requestedStepId,
    selectedOptionId: optionId,
    transition: { ...transition, evaluation: transition.evaluation },
    scoreTotal: s.scoreTotal,
    decisionCount: s.decisions.length + 1,
    createdAt: now(),
    replayed: false,
  }
  s.decisions.push(decision)
  save(store)
  return copy(decision)
}
export function localAdvance(
  sessionId: string,
  requestedStepId: string,
): AdvanceSimulationResult {
  const store = getStore(),
    s = ownedAttempt(store, sessionId),
    c = availableCase(store, s.caseId)
  if (s.advances[requestedStepId])
    return copy({ ...s.advances[requestedStepId], replayed: true })
  if (s.status !== 'in_progress' || stepId(c, s.stepIndex) !== requestedStepId)
    fail('Etapa fora da sequência atual.')
  const decision = s.decisions.find((d) => d.stepId === requestedStepId)
  const transition = decision?.transition ?? transitionFor(c, s.stepIndex, null)
  if (transition.completed) {
    s.status = 'completed'
    s.completedAt = now()
  } else
    s.stepIndex = c.draft.steps.findIndex(
      (st) => st.key === transition.nextStepKey,
    )
  const result: AdvanceSimulationResult = {
    sessionId,
    status: s.status,
    currentStepId: stepId(c, s.stepIndex),
    currentStepKey: c.draft.steps[s.stepIndex].key,
    previousStepId: requestedStepId,
    scoreTotal: s.scoreTotal,
    decisionCount: s.decisions.length,
    completedAt: s.completedAt,
    presentationState: transition.presentationState,
    replayed: false,
  }
  s.advances[requestedStepId] = result
  save(store)
  return copy(result)
}
export function localAbandon(sessionId: string): AbandonedSimulationSession {
  const store = getStore(),
    s = ownedAttempt(store, sessionId, false)
  if (s.status === 'completed') fail('Esta tentativa já foi concluída.')
  s.status = 'abandoned'
  save(store)
  return {
    sessionId,
    caseId: s.caseId,
    status: 'abandoned',
    scoreTotal: s.scoreTotal,
    decisionCount: s.decisions.length,
    startedAt: s.startedAt,
    abandonedAt: now(),
  }
}
function debriefFor(store: LocalStore, s: LocalAttempt): SimulationDebrief {
  if (s.status !== 'completed' || !s.completedAt)
    fail('Este resultado ainda não está disponível.')
  const c = store.cases.find((c) => c.id === s.caseId) ?? fail()
  const decisions: DebriefDecision[] = s.decisions.map((d) => {
    const index = c.draft.steps.findIndex((_, i) => stepId(c, i) === d.stepId),
      step = c.draft.steps[index]
    return {
      actionId: d.actionId,
      stepId: d.stepId,
      stepKey: step.key,
      stepTitle: step.title,
      position: index + 1,
      selectedOptionId: d.selectedOptionId,
      selectedOptionLabel:
        step.options.find((o) => o.id === d.selectedOptionId)?.label ?? '',
      ...d.transition.evaluation,
      createdAt: d.createdAt,
    }
  })
  return copy({
    sessionId: s.id,
    caseId: c.id,
    caseTitle: c.draft.title,
    educationalObjective: c.draft.objective,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    summary: {
      scoreTotal: s.scoreTotal,
      decisionCount: decisions.length,
      classifications: {
        ideal: decisions.filter((d) => d.classification === 'ideal').length,
        acceptable: decisions.filter((d) => d.classification === 'acceptable')
          .length,
        needsImprovement: decisions.filter(
          (d) => d.classification === 'needs_improvement',
        ).length,
        unsafe: decisions.filter((d) => d.classification === 'unsafe').length,
      },
    },
    decisions,
    references: practiceCaseDefinitions.find(definition => definition.caseId === c.id)?.references ?? (c.draft.reference.trim()
      ? [
          {
            id: 'referencia-docente',
            authority: 'Referência informada pelo docente',
            title: c.draft.reference,
            year: null,
            url: null,
            verifiedOn: null,
          },
        ]
      : []),
  })
}
export function localStudentDebrief(sessionId: string) {
  const store = getStore()
  return debriefFor(store, ownedAttempt(store, sessionId, false))
}
export function localTeacherDebrief(sessionId: string) {
  const store = getStore(),
    s = store.sessions.find((s) => s.id === sessionId) ?? fail(),
    a = store.assignments.find((a) => a.id === s.assignmentId) ?? fail()
  ownedClassroom(store, a.classroomId)
  return {
    debrief: debriefFor(store, s),
    email: store.identities.find((u) => u.userId === s.userId)?.email ?? '',
    feedback: s.feedback,
  }
}
export function localSaveFeedback(sessionId: string, feedback: string) {
  localTeacherDebrief(sessionId)
  if (feedback.length > 5000)
    fail('O comentário deve ter até 5.000 caracteres.')
  const store = getStore(),
    s = store.sessions.find((s) => s.id === sessionId) ?? fail()
  s.feedback = feedback
  save(store)
}

export function localSetTeachingSubject(subject: string) {
 const user = identity('teacher'), store = getStore()
 if (!subject.trim() || subject.trim().length > 160) fail('Informe a matéria lecionada (até 160 caracteres).')
 const stored = store.identities.find(item => item.userId === user.userId)!
 stored.subject = subject.trim(); save(store)
 window.dispatchEvent(new Event(portalChangeEvent))
 return copy(stored)
}
