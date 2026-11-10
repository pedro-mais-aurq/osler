import { TeachingSubject } from '../features/teaching/TeachingSubject'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import * as service from '../services/teaching'
import { usePortal } from '../features/teaching/usePortal'
import type {
  Classroom,
  ServiceResult,
  TeacherWorkspace,
} from '../features/teaching/types'
import { courseLabels } from '../features/teaching/validation'
import {
  AccessState,
  dateLabel,
  EmptyState,
  Icon,
  PageHeading,
  PortalLayout,
  statusLabel,
} from '../features/teaching/ui'
import {
  AssignmentForm,
  ClassroomForm,
  InviteForm,
} from '../features/teaching/TeacherForms'
import { CaseEditor } from '../features/teaching/CaseEditor'
import { TeacherDebriefView } from '../features/teaching/TeacherDebriefView'
import { practiceCaseDefinitions } from '../features/teaching/practiceCasePacks'
import { ClassroomJoinCode } from '../features/teaching/ClassroomJoinCode'

type Modal =
  | { kind: 'classroom'; classroom?: Classroom }
  | { kind: 'invite' | 'assignment'; classroom: Classroom }
export function TeacherPage() {
  const portal = usePortal(),
    location = useLocation(),
    navigate = useNavigate()
  const [workspace, setWorkspace] = useState<TeacherWorkspace | null>(null),
    [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<Modal | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState<string | null>(null)
  const [filterClass, setFilterClass] = useState(''),
    [filterAssignment, setFilterAssignment] = useState(''),
    [search, setSearch] = useState('')
  const mutationLock = useRef(false)
  const identityId = portal.identity?.userId
  const teacher =
    portal.identity?.role === 'teacher' || portal.identity?.role === 'admin'
  const [section = '', itemId] = location.pathname.split('/').slice(2)
  const load = useCallback(async () => {
    const r = await service.getTeacherWorkspace()
    if (r.ok) {
      setWorkspace(r.value)
      setError(null)
    } else setError(r.message)
  }, [])
  useEffect(() => {
    if (!identityId || !teacher) return
    let active = true
    setWorkspace(null)
    void service.getTeacherWorkspace().then((r) => {
      if (active) {
        if (r.ok) {
          setWorkspace(r.value)
          setError(null)
        } else setError(r.message)
      }
    })
    const timer = window.setInterval(() => {
      if (
        active &&
        document.visibilityState === 'visible' &&
        !mutationLock.current
      )
        void load()
    }, 20000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [identityId, teacher, load])
  useEffect(() => {
    setModal(null)
    setMessage(null)
  }, [location.pathname])
  async function mutate(
    action: () => Promise<ServiceResult<unknown>>,
    success: string,
    close = false,
  ): Promise<ServiceResult<unknown>> {
    if (mutationLock.current)
      return { ok: false, message: 'Aguarde a operação em andamento.' }
    mutationLock.current = true
    setBusy(true)
    setError(null)
    try {
      const r = await action()
      if (r.ok) {
        setMessage(success)
        if (close) setModal(null)
        await load()
      } else if (!close) setError(r.message)
      return r
    } finally {
      mutationLock.current = false
      setBusy(false)
    }
  }
  if (portal.loading) return <AccessState loading />
  if (!portal.identity && !portal.error) return <Navigate to="/entrar?perfil=professor" replace />
  if (!portal.identity)
    return (
      <AccessState
        error={portal.error}
        retry={portal.error ? portal.refresh : undefined}
      />
    )
  if (!teacher)
    return (
      <section className="page-card"><h1>Ensine com a Osler</h1><p>Escolha o perfil de professor para criar suas turmas e casos clínicos.</p><button className="primary-action" disabled={busy} onClick={async () => { setBusy(true); const result = await service.getPortalIdentity('teacher'); if (result.ok) portal.refresh(); else setError(result.message); setBusy(false) }}>Escolher ser professor</button>{error && <p role="alert">{error}</p>}</section>
    )
  if (!workspace)
    return (
      <AccessState
        loading={!error}
        error={error}
        retry={error ? () => void load() : undefined}
      />
    )
  const w = workspace
  const classroom = w.classrooms.find((c) => c.id === itemId)
  const activeClasses = w.classrooms.filter((c) => !c.archived)
  const completed = w.attempts.filter((a) => a.status === 'completed')
  const activeStudents = new Set(
    w.enrollments
      .filter(
        (e) =>
          e.status !== 'revoked' &&
          activeClasses.some((c) => c.id === e.classroomId),
      )
      .map((e) => e.email),
  ).size
  const classCard = (c: Classroom) => {
    const students = w.enrollments.filter(
      (e) => e.classroomId === c.id && e.status !== 'revoked',
    )
    const assignments = w.assignments.filter((a) => a.classroomId === c.id)
    const done = new Set(
      completed
        .filter(
          (s) =>
            assignments.some((a) => a.id === s.assignmentId) &&
            students.some((e) => e.studentId === s.studentId),
        )
        .map((s) => s.studentId),
    ).size
    return (
      <Link
        to={`/professor/turmas/${c.id}`}
        className="classroom-card"
        key={c.id}
      >
        <div className="panel-heading">
          <span className="classroom-symbol">
            <Icon name="classes" size={23} />
          </span>
          <span
            className={`teaching-badge ${c.archived ? 'archived' : 'active'}`}
          >
            {c.archived ? 'Arquivada' : courseLabels[c.course]}
          </span>
          <Icon name="arrow" size={19} />
        </div>
        <h3>{c.name}</h3>
        <p>
          {c.description ||
            c.term ||
            'Sua próxima experiência de aprendizagem.'}
        </p>
        <div className="classroom-card-meta">
          <span>{students.length} alunos</span>
          <span>
            {assignments.filter((a) => a.status === 'open').length} atividades
            abertas
          </span>
        </div>
        <div className="participation">
          <span>{done} alunos com tentativa concluída</span>
          <progress max={Math.max(students.length, 1)} value={done} />
        </div>
      </Link>
    )
  }
  const attemptsTable = (attempts: typeof w.attempts) => (
    <div className="teaching-table-wrap">
      <table className="teaching-table">
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Caso e atividade</th>
            <th>Situação</th>
            <th>Pontos brutos</th>
            <th>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((s) => (
            <tr key={s.id}>
              <td>
                <strong>{s.email}</strong>
                <small>{dateLabel(s.startedAt)}</small>
              </td>
              <td>
                {s.caseTitle}
                <small>
                  {w.assignments.find((a) => a.id === s.assignmentId)?.title}
                </small>
              </td>
              <td>
                <span className={`teaching-badge ${s.status}`}>
                  {statusLabel[s.status]}
                </span>
              </td>
              <td>
                {s.scoreTotal}
                <small>{s.decisionCount} decisões</small>
              </td>
              <td>
                {s.status === 'completed' ? (
                  <Link
                    className="table-link"
                    to={`/professor/debriefings/${s.id}`}
                  >
                    Ver trajetória <Icon name="arrow" size={16} />
                  </Link>
                ) : (
                  <span className="muted">Aguardando conclusão</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!attempts.length && (
        <EmptyState title="Nenhuma tentativa por aqui">
          <p>
            Os registros aparecerão quando os alunos iniciarem uma atividade.
          </p>
        </EmptyState>
      )}
    </div>
  )
  return (
    <PortalLayout identity={portal.identity}>
      {section === 'materia' && <TeachingSubject initial={portal.identity.subject} />}
      {error && (
        <div className="teaching-error" role="alert">
          {error}
          <button className="text-action" onClick={() => void load()}>
            Atualizar dados
          </button>
        </div>
      )}
      {message && (
        <div className="teaching-success" role="status">
          {message}
        </div>
      )}
      {!section && (
        <>
          <PageHeading
            eyebrow="SUA SALA DE AULA"
            title="Ensinar. Acompanhar. Evoluir."
            action={
              <button
                className="primary-action"
                onClick={() => setModal({ kind: 'classroom' })}
              >
                <Icon name="plus" size={18} />
                Nova turma
              </button>
            }
          >
            Um olhar próximo sobre cada experiência de aprendizagem.
          </PageHeading>
          <div className="teacher-welcome">
            <div>
              <span className="eyebrow">DA DECISÃO À REFLEXÃO</span>
              <h2>
                Boas perguntas.
                <br />
                <em>Novas perspectivas.</em>
              </h2>
              <p>
                Prepare um caso, convide sua turma e use as trajetórias para
                conduzir a conversa.
              </p>
              <Link className="welcome-link" to="/professor/casos/novo">
                Criar um caso clínico <Icon name="arrow" size={19} />
              </Link>
            </div>
            <div className="welcome-art" aria-hidden="true">
              <div className="art-orbit" />
              <span className="art-cross">+</span>
              <div className="art-clipboard">
                <Icon name="cases" size={92} />
                <span>observar → decidir → refletir</span>
              </div>
              <span className="art-dot" />
            </div>
          </div>
          <div className="teaching-stats">
            <div>
              <span>Turmas em atividade</span>
              <strong>
                {activeClasses.length.toString().padStart(2, '0')}
              </strong>
              <small>Espaços de aprendizagem</small>
            </div>
            <div>
              <span>Alunos cadastrados</span>
              <strong>{activeStudents.toString().padStart(2, '0')}</strong>
              <small>Identificados por e-mail</small>
            </div>
            <div>
              <span>Atividades abertas</span>
              <strong>
                {w.assignments
                  .filter(
                    (a) =>
                      a.status === 'open' &&
                      activeClasses.some((c) => c.id === a.classroomId),
                  )
                  .length.toString()
                  .padStart(2, '0')}
              </strong>
              <small>Prontas para a turma</small>
            </div>
            <div>
              <span>Debriefings disponíveis</span>
              <strong>{completed.length.toString().padStart(2, '0')}</strong>
              <small>Trajetórias para conversar</small>
            </div>
          </div>
          <div className="section-heading">
            <h2>Minhas turmas</h2>
            <Link to="/professor/turmas">
              Ver todas <Icon name="arrow" size={17} />
            </Link>
          </div>
          <div className="classroom-grid">
            {activeClasses.slice(0, 3).map(classCard)}
          </div>
          {!activeClasses.length && (
            <EmptyState title="Sua primeira turma começa aqui">
              <p>Crie uma turma e cadastre os e-mails dos seus alunos.</p>
            </EmptyState>
          )}
          <div className="section-heading">
            <h2>Trajetórias recentes</h2>
            <Link to="/professor/debriefings">
              Acompanhar debriefings <Icon name="arrow" size={17} />
            </Link>
          </div>
          {attemptsTable(
            [...w.attempts]
              .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
              .slice(0, 5),
          )}
        </>
      )}
      {section === 'turmas' && !itemId && (
        <>
          <PageHeading
            eyebrow="GESTÃO DA SALA"
            title="Minhas turmas"
            action={
              <button
                className="primary-action"
                onClick={() => setModal({ kind: 'classroom' })}
              >
                <Icon name="plus" size={18} />
                Nova turma
              </button>
            }
          >
            Organize alunos e atividades em um mesmo espaço.
          </PageHeading>
          <div className="classroom-grid">{w.classrooms.map(classCard)}</div>
          {!w.classrooms.length && (
            <EmptyState title="Crie sua primeira turma">
              <p>Cadastre um nome, o curso e o período da turma.</p>
            </EmptyState>
          )}
        </>
      )}
      {section === 'turmas' &&
        itemId &&
        (classroom ? (
          <>
            <Link className="back-link" to="/professor/turmas">
              ← Minhas turmas
            </Link>
            <PageHeading
              eyebrow={courseLabels[classroom.course]}
              title={classroom.name}
              action={
                <button
                  className="secondary-action"
                  onClick={() => setModal({ kind: 'classroom', classroom })}
                >
                  Editar turma
                </button>
              }
            >
              {classroom.description || classroom.term}
            </PageHeading>
            {classroom.joinCode && !classroom.archived && <ClassroomJoinCode code={classroom.joinCode} />}
            <div className="classroom-toolbar">
              <span
                className={`teaching-badge ${classroom.archived ? 'archived' : 'active'}`}
              >
                {classroom.archived ? 'Turma arquivada' : 'Turma ativa'}
              </span>
              <span className="muted">{classroom.term}</span>
              <button
                className="text-action push-right"
                disabled={busy}
                onClick={() => {
                  if (
                    classroom.archived ||
                    window.confirm(
                      'Arquivar esta turma? As atividades ficarão indisponíveis aos alunos até a reabertura.',
                    )
                  )
                    void mutate(
                      () =>
                        service.archiveClassroom(
                          classroom.id,
                          !classroom.archived,
                        ),
                      classroom.archived
                        ? 'Turma reaberta.'
                        : 'Turma arquivada.',
                    )
                }}
              >
                {classroom.archived ? 'Reabrir turma' : 'Arquivar turma'}
              </button>
            </div>
            <div className="section-heading">
              <h2>Atividades da turma</h2>
              <button
                disabled={classroom.archived}
                className="primary-action"
                onClick={() => setModal({ kind: 'assignment', classroom })}
              >
                <Icon name="plus" size={17} />
                Disponibilizar caso
              </button>
            </div>
            <div className="assignment-list">
              {w.assignments
                .filter((a) => a.classroomId === classroom.id)
                .map((a) => (
                  <article className="teaching-panel assignment-row" key={a.id}>
                    <div>
                      <span className={`teaching-badge ${a.status}`}>
                        {statusLabel[a.status]}
                      </span>
                      <h3>{a.title}</h3>
                      <p>
                        {w.cases.find((c) => c.id === a.caseId)?.draft.title}
                      </p>
                      <small>Prazo sugerido: {dateLabel(a.dueAt)}</small>
                    </div>
                    <div className="assignment-actions">
                      <Link
                        className="table-link"
                        to={`/professor/debriefings?turma=${classroom.id}&atividade=${a.id}`}
                      >
                        {
                          completed.filter((s) => s.assignmentId === a.id)
                            .length
                        }{' '}
                        debriefings <Icon name="arrow" size={16} />
                      </Link>
                      <button
                        className="small-action"
                        disabled={busy || classroom.archived}
                        onClick={() =>
                          void mutate(
                            () =>
                              service.setAssignmentStatus(
                                a.id,
                                a.status === 'open' ? 'closed' : 'open',
                              ),
                            a.status === 'open'
                              ? 'Atividade encerrada.'
                              : 'Atividade reaberta.',
                          )
                        }
                      >
                        {a.status === 'open'
                          ? 'Encerrar atividade'
                          : 'Reabrir atividade'}
                      </button>
                    </div>
                  </article>
                ))}
            </div>
            {!w.assignments.some((a) => a.classroomId === classroom.id) && (
              <EmptyState title="A próxima experiência está por vir">
                <p>
                  Disponibilize um dos seus casos publicados para esta turma.
                </p>
              </EmptyState>
            )}
            <div className="section-heading">
              <h2>Alunos e participação</h2>
              <button
                disabled={classroom.archived}
                className="secondary-action"
                onClick={() => setModal({ kind: 'invite', classroom })}
              >
                <Icon name="plus" size={17} />
                Adicionar alunos
              </button>
            </div>
            <div className="teaching-table-wrap">
              <table className="teaching-table">
                <thead>
                  <tr>
                    <th>E-mail do aluno</th>
                    <th>Vínculo</th>
                    <th>Participação</th>
                    <th>Acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {w.enrollments
                    .filter((e) => e.classroomId === classroom.id)
                    .map((e) => {
                      const attempts = w.attempts.filter(
                        (s) =>
                          s.email === e.email &&
                          w.assignments.some(
                            (a) =>
                              a.id === s.assignmentId &&
                              a.classroomId === classroom.id,
                          ),
                      )
                      return (
                        <tr key={e.id}>
                          <td>
                            <strong>{e.email}</strong>
                          </td>
                          <td>
                            <span className={`teaching-badge ${e.status}`}>
                              {statusLabel[e.status]}
                            </span>
                          </td>
                          <td>
                            {
                              attempts.filter((s) => s.status === 'completed')
                                .length
                            }{' '}
                            concluídas
                            <small>
                              {
                                attempts.filter(
                                  (s) => s.status === 'in_progress',
                                ).length
                              }{' '}
                              em andamento
                            </small>
                          </td>
                          <td>
                            {e.status === 'revoked' ? (
                              <button
                                className="small-action"
                                disabled={busy || classroom.archived}
                                onClick={() =>
                                  void mutate(
                                    () =>
                                      service.enrollStudents(classroom.id, [
                                        e.email,
                                      ]),
                                    'Aluno adicionado novamente.',
                                  )
                                }
                              >
                                Adicionar novamente
                              </button>
                            ) : (
                              <button
                                className="text-action danger"
                                disabled={busy}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Remover o acesso de ${e.email} a esta turma? O histórico será preservado.`,
                                    )
                                  )
                                    void mutate(
                                      () => service.revokeEnrollment(e.id),
                                      'Acesso à turma removido.',
                                    )
                                }}
                              >
                                Remover acesso
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
              {!w.enrollments.some((e) => e.classroomId === classroom.id) && (
                <EmptyState title="Convide seus alunos">
                  <p>O mesmo e-mail cadastrado será usado no login Google.</p>
                </EmptyState>
              )}
            </div>
          </>
        ) : (
          <EmptyState title="Turma indisponível">
            <Link to="/professor/turmas">Voltar às turmas</Link>
          </EmptyState>
        ))}
      {section === 'casos' && !itemId && (
        <>
          <PageHeading
            eyebrow="BIBLIOTECA DO PROFESSOR"
            title="Casos clínicos"
            action={
              <Link className="primary-action" to="/professor/casos/novo">
                <Icon name="plus" size={18} />
                Novo caso
              </Link>
            }
          >
            Crie trajetórias com feedback e consequências definidos por você.
          </PageHeading>
          <section className="case-starters teaching-panel" aria-labelledby="case-starters-title">
            <h2 id="case-starters-title">Roteiros para adaptar</h2>
            <p>Abra uma cópia para adaptar à sua turma e salvar como rascunho.</p>
            <div className="case-starter-grid">{practiceCaseDefinitions.map(definition => {
              const draft = definition.createDraft()
              const decisionCount = draft.steps.filter(step => step.type === 'decision').length
              return <article key={definition.caseId}>
                <p className="eyebrow">{courseLabels[draft.course]} · {draft.steps.length} etapas · {decisionCount} decisões</p>
                <h3>{draft.title}</h3>
                <button
                  className="secondary-action"
                  type="button"
                  aria-label={`Usar roteiro: ${draft.title}`}
                  onClick={() => navigate('/professor/casos/novo', { state: { draft } })}
                >
                  Usar roteiro <Icon name="arrow" size={16} />
                </button>
              </article>
            })}</div>
          </section>
          <div className="case-grid">
            {w.cases.map((c) => (
              <article className="teaching-panel case-card" key={c.id}>
                <div className="panel-heading">
                  <Icon name="cases" size={26} />
                  <span className={`teaching-badge ${c.status}`}>
                    {statusLabel[c.status]}
                  </span>
                </div>
                <p className="eyebrow">{courseLabels[c.draft.course]}</p>
                <p className="case-visibility-label">{c.draft.visibility === 'public' ? 'Público · permite prática individual' : 'Privado · acesso por turma'}</p>
                <h2>{c.draft.title}</h2>
                <p>{c.draft.description}</p>
                <div className="case-card-facts">
                  <span>{c.draft.steps.length} etapas</span>
                  <span>
                    {c.draft.steps.filter((s) => s.type === 'decision').length}{' '}
                    decisões
                  </span>
                </div>
                <div className="case-card-actions">
                  <Link className="table-link" to={`/professor/casos/${c.id}`}>
                    {c.status === 'draft'
                      ? 'Continuar edição'
                      : 'Consultar caso'}
                    <Icon name="arrow" size={16} />
                  </Link>
                  <button
                    className="small-action"
                    onClick={() =>
                      navigate('/professor/casos/novo', {
                        state: {
                          draft: {
                            ...structuredClone(c.draft),
                            title: `${c.draft.title.slice(0, 140)} · cópia`,
                            reviewed: false,
                            visibility: 'private',
                          },
                        },
                      })
                    }
                  >
                    Duplicar
                  </button>
                  {c.status !== 'archived' && (
                    <button
                      className="text-action danger"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Arquivar este caso? Suas atividades serão encerradas. O histórico permanece disponível.',
                          )
                        )
                          void mutate(
                            () => service.archiveTeachingCase(c.id),
                            'Caso arquivado.',
                          )
                      }}
                    >
                      Arquivar
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!w.cases.length && (
            <EmptyState title="Qual situação sua turma vai explorar?">
              <p>
                Comece por um objetivo de aprendizagem e construa o seu primeiro
                caso.
              </p>
            </EmptyState>
          )}
        </>
      )}
      {section === 'casos' &&
        itemId &&
        (itemId === 'novo' || w.cases.some((c) => c.id === itemId) ? (
          <CaseEditor
            key={`${itemId}-${location.key}`}
            existing={w.cases.find((c) => c.id === itemId)}
            initial={
              (
                location.state as {
                  draft?: import('../features/teaching/types').CaseDraft
                } | null
              )?.draft
            }
            busy={busy}
            onSave={async (draft, publish) => {
              if (mutationLock.current)
                return {
                  ok: false,
                  message: 'Aguarde a operação em andamento.',
                }
              mutationLock.current = true
              setBusy(true)
              try {
                const r = await service.saveTeachingCase(
                  draft,
                  itemId === 'novo' ? undefined : itemId,
                  publish,
                )
                if (r.ok) {
                  await load()
                  navigate('/professor/casos')
                  setMessage(
                    publish
                      ? 'Caso publicado. Agora disponibilize-o para uma turma.'
                      : 'Rascunho salvo.',
                  )
                }
                return r
              } finally {
                mutationLock.current = false
                setBusy(false)
              }
            }}
          />
        ) : (
          <EmptyState title="Caso indisponível">
            <Link to="/professor/casos">Voltar aos casos</Link>
          </EmptyState>
        ))}
      {section === 'debriefings' && !itemId && (
        <>
          <PageHeading
            eyebrow="ACOMPANHAMENTO DA APRENDIZAGEM"
            title="Debriefings da turma"
            action={
              <button
                className="secondary-action"
                disabled={busy}
                onClick={() => void load()}
              >
                Atualizar
              </button>
            }
          >
            Observe escolhas, retome feedbacks e prepare a próxima conversa.
          </PageHeading>
          <div className="debrief-filters">
            <label className="teaching-field">
              Turma
              <select
                value={
                  filterClass ||
                  new URLSearchParams(location.search).get('turma') ||
                  ''
                }
                onChange={(e) => {
                  setFilterClass(e.target.value)
                  setFilterAssignment('')
                  navigate('/professor/debriefings', { replace: true })
                }}
              >
                <option value="">Todas as turmas</option>
                {w.classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="teaching-field">
              Atividade
              <select
                value={
                  filterAssignment ||
                  new URLSearchParams(location.search).get('atividade') ||
                  ''
                }
                onChange={(e) => {
                  setFilterAssignment(e.target.value)
                  if (location.search) {
                    setFilterClass(
                      new URLSearchParams(location.search).get('turma') || '',
                    )
                    navigate('/professor/debriefings', { replace: true })
                  }
                }}
              >
                <option value="">Todas as atividades</option>
                {w.assignments
                  .filter(
                    (a) =>
                      !(
                        filterClass ||
                        new URLSearchParams(location.search).get('turma')
                      ) ||
                      a.classroomId ===
                        (filterClass ||
                          new URLSearchParams(location.search).get('turma')),
                  )
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
              </select>
            </label>
            <label className="teaching-field">
              Buscar aluno
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="E-mail do aluno"
              />
            </label>
          </div>
          {attemptsTable(
            [...w.attempts]
              .filter((s) => {
                const a = w.assignments.find((a) => a.id === s.assignmentId),
                  c =
                    filterClass ||
                    new URLSearchParams(location.search).get('turma'),
                  activity =
                    filterAssignment ||
                    new URLSearchParams(location.search).get('atividade')
                return (
                  (!c || a?.classroomId === c) &&
                  (!activity || s.assignmentId === activity) &&
                  s.email.toLowerCase().includes(search.toLowerCase())
                )
              })
              .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
          )}
          <p className="muted">
            Atualização automática a cada 20 segundos enquanto esta página
            estiver aberta. A pontuação descreve a tentativa e não representa
            competência profissional geral.
          </p>
        </>
      )}
      {section === 'debriefings' && itemId && (
        <TeacherDebriefView key={itemId} sessionId={itemId} />
      )}
      {!['', 'turmas', 'casos', 'debriefings'].includes(section) && (
        <EmptyState title="Página indisponível">
          <Link to="/professor">Voltar à visão geral</Link>
        </EmptyState>
      )}
      {modal?.kind === 'classroom' && (
        <ClassroomForm
          classroom={modal.classroom}
          busy={busy}
          onClose={() => {
            if (!busy) setModal(null)
          }}
          onSave={(input) =>
            mutate(
              () => service.saveClassroom(input, modal.classroom?.id),
              'Turma salva.',
              true,
            )
          }
        />
      )}
      {modal?.kind === 'invite' && (
        <InviteForm
          busy={busy}
          onClose={() => {
            if (!busy) setModal(null)
          }}
          onSave={(emails) =>
            mutate(
              () => service.enrollStudents(modal.classroom.id, emails),
              'Alunos cadastrados. O vínculo será concluído pelo e-mail do Google.',
              true,
            )
          }
        />
      )}
      {modal?.kind === 'assignment' && (
        <AssignmentForm
          cases={w.cases.filter(
            (c) =>
              c.status === 'published' &&
              c.draft.course === modal.classroom.course,
          )}
          busy={busy}
          onClose={() => {
            if (!busy) setModal(null)
          }}
          onSave={(caseId, title, dueAt) =>
            mutate(
              () =>
                service.assignCase(modal.classroom.id, caseId, title, dueAt),
              'Atividade disponibilizada para a turma.',
              true,
            )
          }
        />
      )}
    </PortalLayout>
  )
}
