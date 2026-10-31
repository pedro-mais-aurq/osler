import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { getStudentWorkspace } from '../services/teaching'
import { updateCurrentStudentCourse } from '../services/student'
import { usePortal } from '../features/teaching/usePortal'
import type {
  StudentAssignment,
  StudentWorkspace,
} from '../features/teaching/types'
import {
  AccessState,
  dateLabel,
  EmptyState,
  Icon,
  PageHeading,
  PortalLayout,
  statusLabel,
} from '../features/teaching/ui'
import { courseLabels } from '../features/teaching/validation'

export function StudentPage() {
  const portal = usePortal(),
    navigate = useNavigate()
  const [data, setData] = useState<StudentWorkspace | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState<string | null>(null),
    [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!portal.identity || portal.identity.role !== 'student') return
    let active = true
    void getStudentWorkspace().then((r) => {
      if (!active) return
      if (r.ok) {
        setData(r.value)
        setError(null)
      } else setError(r.message)
    })
    return () => {
      active = false
    }
  }, [portal.identity, revision])
  async function launch(a: StudentAssignment) {
    if (busy) return
    setBusy(a.id)
    const result = await updateCurrentStudentCourse(a.course)
    if (!result.ok) {
      setError(result.message)
      setBusy(null)
      return
    }
    navigate(`/simulacao?case=${a.caseId}&atividade=${a.id}`)
  }
  if (portal.loading) return <AccessState loading />
  if (!portal.identity && !portal.error) return <Navigate to="/entrar" replace />
  if (!portal.identity)
    return (
      <AccessState
        error={portal.error}
        retry={portal.error ? portal.refresh : undefined}
      />
    )
  if (portal.identity.role !== 'student')
    return (
      <AccessState error="Entre com uma conta de aluno para realizar atividades. Sua conta atual tem acesso à área do professor." />
    )
  return (
    <PortalLayout identity={portal.identity}>
      <PageHeading
        eyebrow="SUA JORNADA DE APRENDIZAGEM"
        title="Minhas atividades"
        action={
          <button
            className="secondary-action"
            onClick={() => setRevision((v) => v + 1)}
          >
            Atualizar
          </button>
        }
      >
        Olá, {portal.identity.displayName.split(' ')[0]}. Uma decisão de cada
        vez.
      </PageHeading>
      <div className="student-learning-options"><Link className="secondary-action" to="/participacao">Entrar em uma turma</Link><Link className="secondary-action" to="/casos-publicos">Praticar casos públicos</Link></div>
      {error && (
        <p className="teaching-error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Carregando atividades…</p>}
      {data && (
        <>
          <div className="student-context">
            <Icon name="classes" size={25} />
            <div>
              <strong>
                {data.classrooms.length}{' '}
                {data.classrooms.length === 1
                  ? 'turma vinculada'
                  : 'turmas vinculadas'}
              </strong>
              <p>
                O acesso usa o e-mail <strong>{portal.identity.email}</strong>.
                Se uma turma não aparecer, confirme esse endereço com seu
                professor.
              </p>
            </div>
          </div>
          <div className="student-assignments">
            {data.assignments.map((a) => {
              const attempts = data.attempts
                  .filter((s) => s.assignmentId === a.id)
                  .sort((s, t) => t.startedAt.localeCompare(s.startedAt)),
                completed = attempts.filter((s) => s.status === 'completed'),
                active = attempts.find((s) => s.status === 'in_progress')
              return (
                <article
                  className="teaching-panel student-assignment"
                  key={a.id}
                >
                  <div className="panel-heading">
                    <p className="eyebrow">
                      {courseLabels[a.course]} · {a.classroomName}
                    </p>
                    <span className={`teaching-badge ${a.status}`}>
                      {statusLabel[a.status]}
                    </span>
                  </div>
                  <h2>{a.title}</h2>
                  <h3>{a.caseTitle}</h3>
                  <p>{a.description}</p>
                  <div className="student-objective">
                    <strong>O que vamos explorar</strong>
                    <p>{a.objective}</p>
                  </div>
                  <div className="assignment-footer">
                    <span className="muted">
                      <Icon name="clock" size={16} />
                      Prazo sugerido: {dateLabel(a.dueAt)}
                    </span>
                    {a.status === 'open' && (
                      <button
                        className="primary-action"
                        disabled={busy !== null}
                        onClick={() => void launch(a)}
                      >
                        {busy === a.id
                          ? 'Preparando…'
                          : active
                            ? 'Continuar tentativa'
                            : completed.length
                              ? 'Fazer nova tentativa'
                              : 'Iniciar simulação'}
                        <Icon name="arrow" size={17} />
                      </button>
                    )}
                  </div>
                  {completed.length > 0 && (
                    <div className="student-history">
                      <h4>Suas tentativas concluídas</h4>
                      {completed.map((s) => (
                        <div key={s.id}>
                          <Link
                            className="table-link"
                            to={`/resultado?session=${s.id}&atividade=${a.id}`}
                          >
                            Ver meu debriefing · {dateLabel(s.completedAt)}{' '}
                            <Icon name="arrow" size={15} />
                          </Link>
                          <small>
                            {s.scoreTotal} pontos brutos · {s.decisionCount}{' '}
                            decisões
                          </small>
                          {s.feedback && (
                            <blockquote>
                              <strong>Devolutiva do professor</strong>
                              <p>{s.feedback}</p>
                            </blockquote>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
          {!data.assignments.length && (
            <EmptyState title="Sua próxima experiência está chegando">
              <p>
                Seu professor precisa cadastrar seu e-mail e disponibilizar um
                caso para a turma.
              </p>
            </EmptyState>
          )}
        </>
      )}
    </PortalLayout>
  )
}
