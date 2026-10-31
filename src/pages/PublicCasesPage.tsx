import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { getCurrentStudent } from '../services/student'
import { getPublicPractice } from '../services/teaching'
import { getStudentCourseLabel } from '../features/onboarding/courses'
import type { PublicPracticeWorkspace } from '../features/teaching/types'
import type { StudentCourse } from '../types/database'

export function PublicCasesPage() {
  const navigate = useNavigate()
  const [course, setCourse] = useState<StudentCourse | null>(null)
  const [data, setData] = useState<PublicPracticeWorkspace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    async function load() {
      setError(null); setData(null)
      const student = await getCurrentStudent()
      if (!active) return
      if (!student.ok) { if (student.reason === 'not_authenticated') navigate('/entrar', { replace: true }); else setError(student.message); return }
      if (!student.student.course) { navigate('/curso', { replace: true }); return }
      setCourse(student.student.course)
      const result = await getPublicPractice(student.student.course)
      if (!active) return
      if (result.ok) setData(result.value)
      else setError(result.message)
    }
    void load()
    return () => { active = false }
  }, [navigate, revision])
  const completed = data?.attempts.filter(attempt => attempt.status === 'completed').sort((a, b) => b.startedAt.localeCompare(a.startedAt)) ?? []
  return <section className="clinical-case-catalogue public-case-catalogue" aria-labelledby="public-catalogue-title">
    <div className="case-catalogue-heading"><div><p className="eyebrow">{course ? getStudentCourseLabel(course) : 'SUA FORMAÇÃO'} · PRÁTICA INDIVIDUAL</p><h1 id="public-catalogue-title">Casos públicos</h1><p>Explore os cenários disponíveis sem entrar em uma turma.</p></div><Link className="secondary-action" to="/participacao">Estudar com uma turma <Icon name="arrow" width="16" height="16" /></Link></div>
    {!data && !error && <p role="status">Carregando casos públicos…</p>}
    {error && <div className="status-message status-error" role="alert"><p>{error}</p><button className="text-action" type="button" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button></div>}
    {data && <>
      <div className="clinical-case-grid">{data.cases.map(item => <article className="clinical-case-card" key={item.id}>
        <div className="clinical-case-meta"><Icon name={item.course === 'nursing' ? 'heart' : 'flask'} width="24" height="24" /><span>Público · {item.stepCount} etapas · {item.expectedDecisions} decisões</span></div>
        <h2>{item.title}</h2><p>{item.description}</p><div className="clinical-case-objective"><strong>O que vamos explorar</strong><p>{item.objective}</p></div>
        <Link className="primary-action" aria-label={'Praticar caso público: ' + item.title} to={`/simulacao?case=${encodeURIComponent(item.id)}&modo=publico`}>{data.attempts.some(attempt => attempt.caseId === item.id && attempt.status === 'in_progress') ? 'Continuar prática' : 'Praticar este caso'} <Icon name="arrow" width="17" height="17" /></Link>
      </article>)}</div>
      {!data.cases.length && <div className="empty-state"><h2>Novos cenários estão a caminho</h2><p>Ainda não há casos públicos publicados para esta formação.</p></div>}
      <section className="public-practice-history" aria-labelledby="practice-history-title"><h2 id="practice-history-title">Minhas tentativas individuais</h2>{completed.length ? <ul>{completed.map(attempt => <li key={attempt.id}><div><strong>{attempt.caseTitle}</strong><span>{attempt.decisionCount} decisões · {attempt.scoreTotal} pontos brutos</span></div><Link to={`/resultado?session=${encodeURIComponent(attempt.id)}`}>Ver debriefing <Icon name="arrow" width="15" height="15" /></Link></li>)}</ul> : <p>Ao concluir um caso público, seu debriefing ficará disponível aqui.</p>}</section>
    </>}
    <Link className="case-catalogue-activities" to="/curso"><Icon name="back" width="15" height="15" /> Trocar formação</Link>
  </section>
}
