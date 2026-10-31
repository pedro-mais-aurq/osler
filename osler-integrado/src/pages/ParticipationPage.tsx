import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { getCurrentStudent, updateCurrentStudentCourse } from '../services/student'
import { getStudentWorkspace, joinClassroom } from '../services/teaching'
import { getStudentCourseLabel } from '../features/onboarding/courses'
import type { Classroom } from '../features/teaching/types'
import type { StudentCourse } from '../types/database'

export function ParticipationPage() {
  const navigate = useNavigate()
  const [course, setCourse] = useState<StudentCourse | null>(null)
  const [classrooms, setClassrooms] = useState<Classroom[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true); setError(null)
      const student = await getCurrentStudent()
      if (!active) return
      if (!student.ok) {
        if (student.reason === 'not_authenticated') navigate('/entrar', { replace: true })
        else setError(student.message)
        setLoading(false); return
      }
      if (!student.student.course) { navigate('/curso', { replace: true }); return }
      setCourse(student.student.course)
      const workspace = await getStudentWorkspace()
      if (!active) return
      if (workspace.ok) setClassrooms(workspace.value.classrooms.filter(item => item.course === student.student.course))
      else setError(workspace.message)
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [navigate, revision])

  async function join(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(null)
    const result = await joinClassroom(code)
    if (!result.ok) { setError(result.message); setBusy(false); return }
    const saved = await updateCurrentStudentCourse(result.value.course)
    if (!saved.ok) { setError(saved.message); setBusy(false); return }
    navigate('/aluno')
  }

  return <section className="participation-page" aria-labelledby="participation-title">
    <p className="eyebrow">{course ? getStudentCourseLabel(course) : 'SUA JORNADA'} · VOCÊ ESCOLHE O CAMINHO</p>
    <h1 id="participation-title">Como você quer aprender?</h1>
    <p className="participation-intro">Aprenda junto à sua turma ou explore novos casos no seu ritmo. Você pode mudar de caminho quando quiser.</p>
    {loading ? <p role="status">Preparando seus caminhos de aprendizagem…</p> : <div className="participation-grid">
      <article className="participation-card"><span className="formation-choice-symbol"><Icon name="people" width="31" height="31" /></span><p className="eyebrow">APRENDER EM CONJUNTO</p><h2>Com uma turma</h2><p>Acesse as atividades que seu professor preparou e receba devolutivas sobre as suas tentativas.</p><button className="primary-action" type="button" aria-expanded={expanded} aria-controls="join-classroom-panel" onClick={() => setExpanded(value => !value)}>Entrar em uma turma <Icon name="arrow" width="17" height="17" /></button></article>
      <article className="participation-card independent"><span className="formation-choice-symbol"><Icon name="book" width="31" height="31" /></span><p className="eyebrow">SEU PRÓPRIO PERCURSO</p><h2>Por conta própria</h2><p>Escolha entre os casos públicos da sua formação, pratique e acompanhe seu debriefing individual.</p><Link className="primary-action" to="/casos-publicos">Praticar sem turma <Icon name="arrow" width="17" height="17" /></Link><small>As tentativas individuais ficam no seu histórico e não são enviadas a um professor.</small></article>
    </div>}
    {expanded && <div className="join-classroom-panel" id="join-classroom-panel">
      {classrooms.length > 0 && <div><h2>Suas turmas</h2><ul>{classrooms.map(item => <li key={item.id}>{item.name}</li>)}</ul><Link className="secondary-action" to="/simulacao">Acessar atividades da turma <Icon name="arrow" width="16" height="16" /></Link></div>}
      <form onSubmit={event => void join(event)}><h2>{classrooms.length ? 'Entrar em outra turma' : 'Entre com o código da turma'}</h2><p>Use o código informado pelo seu professor. Convites feitos para o seu e-mail também aparecem nas suas turmas.</p><label className="teaching-field">Código da turma<input required maxLength={32} value={code} onChange={event => setCode(event.target.value)} autoComplete="off" placeholder="OSLER-…" /></label><button className="primary-action" type="submit" disabled={busy || !code.trim()}>{busy ? 'Entrando…' : 'Confirmar entrada'}</button></form>
    </div>}
    {error && <div className="status-message status-error" role="alert"><p>{error}</p>{!expanded && <button className="text-action" type="button" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button>}</div>}
    <Link className="case-catalogue-activities" to="/curso"><Icon name="back" width="15" height="15" /> Trocar formação</Link>
  </section>
}
