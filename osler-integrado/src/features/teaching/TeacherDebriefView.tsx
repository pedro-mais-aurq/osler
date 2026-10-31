import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTeacherDebrief, saveTeacherFeedback } from '../../services/teaching'
import type { TeacherDebrief } from './types'
import { classificationLabels } from './validation'
import { dateLabel, PageHeading } from './ui'

export function TeacherDebriefView({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<TeacherDebrief | null>(null),
    [feedback, setFeedback] = useState('')
  const [error, setError] = useState<string | null>(null),
    [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setData(null)
    setError(null)
    void getTeacherDebrief(sessionId).then((r) => {
      if (!active) return
      if (r.ok) {
        setData(r.value)
        setFeedback(r.value.feedback)
      } else setError(r.message)
    })
    return () => {
      active = false
    }
  }, [sessionId, revision])
  return (
    <>
      <Link className="back-link" to="/professor/debriefings">
        ← Debriefings da turma
      </Link>
      {!data ? (
        <div className="teaching-panel">
          <h2>{error ? 'Resultado indisponível' : 'Carregando debriefing…'}</h2>
          {error && (
            <>
              <p className="teaching-error" role="alert">
                {error}
              </p>
              <button
                className="secondary-action"
                onClick={() => setRevision((v) => v + 1)}
              >
                Tentar novamente
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <PageHeading
            eyebrow="TRAJETÓRIA DO ALUNO"
            title={data.debrief.caseTitle}
          >
            {data.email} · Concluída em {dateLabel(data.debrief.completedAt)}
          </PageHeading>
          <div className="teaching-stats">
            <div>
              <span>Pontuação bruta</span>
              <strong>{data.debrief.summary.scoreTotal}</strong>
              <small>Não equivale a uma nota.</small>
            </div>
            <div>
              <span>Decisões registradas</span>
              <strong>{data.debrief.summary.decisionCount}</strong>
              <small>Snapshot desta tentativa</small>
            </div>
            <div>
              <span>Escolhas ideais</span>
              <strong>{data.debrief.summary.classifications.ideal}</strong>
              <small>Contexto deste caso</small>
            </div>
          </div>
          <div className="teaching-panel">
            <p className="eyebrow">OBJETIVO DE APRENDIZAGEM</p>
            <p>{data.debrief.educationalObjective}</p>
          </div>
          <h2 className="section-title">O caminho percorrido</h2>
          <ol className="teacher-timeline">
            {data.debrief.decisions.map((d, i) => (
              <li key={d.actionId}>
                <span className="timeline-number">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <article className="teaching-panel">
                  <div className="panel-heading">
                    <h3>{d.stepTitle ?? d.stepKey}</h3>
                    <span className={`teaching-badge ${d.classification}`}>
                      {classificationLabels[d.classification]}
                    </span>
                    <strong className="push-right">
                      {d.scoreDelta > 0 ? '+' : ''}
                      {d.scoreDelta} pts
                    </strong>
                  </div>
                  <dl className="teacher-decision">
                    <div>
                      <dt>Escolha do aluno</dt>
                      <dd>{d.selectedOptionLabel}</dd>
                    </div>
                    <div>
                      <dt>Feedback registrado</dt>
                      <dd>{d.feedback}</dd>
                    </div>
                    {d.consequence && (
                      <div>
                        <dt>Consequência</dt>
                        <dd>{d.consequence}</dd>
                      </div>
                    )}
                  </dl>
                </article>
              </li>
            ))}
          </ol>
          <div className="teaching-panel">
            <h2>Referências do caso</h2>
            {data.debrief.references.length ? (
              data.debrief.references.map((r) => (
                <p key={r.id}>
                  <strong>{r.authority}</strong> — {r.title}
                  {r.url && (
                    <>
                      {' '}
                      ·{' '}
                      <a href={r.url} target="_blank" rel="noreferrer">
                        Consultar fonte
                      </a>
                    </>
                  )}
                </p>
              ))
            ) : (
              <p className="muted">
                Nenhuma referência disponível para esta tentativa.
              </p>
            )}
          </div>
          <form
            className="teaching-panel teaching-form"
            onSubmit={async (e) => {
              e.preventDefault()
              if (busy) return
              setBusy(true)
              setSaved(false)
              const r = await saveTeacherFeedback(sessionId, feedback)
              if (r.ok) {
                setSaved(true)
                setError(null)
              } else setError(r.message)
              setBusy(false)
            }}
          >
            <h2>Devolutiva do professor</h2>
            <label className="teaching-field">
              Comentário para o aluno
              <textarea
                rows={5}
                maxLength={5000}
                value={feedback}
                onChange={(e) => {
                  setFeedback(e.target.value)
                  setSaved(false)
                }}
                placeholder="O que vale retomar no próximo encontro?"
              />
            </label>
            <p className="muted">
              Este comentário ficará disponível ao aluno em suas atividades.
            </p>
            {error && (
              <p role="alert" className="teaching-error">
                {error}
              </p>
            )}
            {saved && (
              <p role="status" className="teaching-success">
                Devolutiva salva.
              </p>
            )}
            <button disabled={busy} className="primary-action">
              {busy ? 'Salvando…' : 'Salvar devolutiva'}
            </button>
          </form>
        </>
      )}
    </>
  )
}
