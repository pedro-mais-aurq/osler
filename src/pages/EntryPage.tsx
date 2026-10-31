import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { isLocalMode } from '../lib/dataMode'
import { signInWithGoogle } from '../services/teaching'
import { demoStudents, demoTeacher } from '../features/teaching/demoFixtures'
import { loginLocal } from '../features/teaching/localStore'
import { usePortal } from '../features/teaching/usePortal'
import { loginCourseKey, parseEntryCourse } from '../features/onboarding/entryIntent'
import { getStudentCourseLabel } from '../features/onboarding/courses'

export function EntryPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const portal = usePortal()
  const inFlight = useRef(false)
  const course = parseEntryCourse(searchParams.get('curso'))
  const [email, setEmail] = useState(demoStudents[course === 'clinical_analysis' ? 4 : 0].email)
  const [busy, setBusy] = useState<'teacher' | 'student' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const teacherFirst = searchParams.get('perfil') === 'professor'

  async function enter(role: 'teacher' | 'student') {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(role)
    setError(null)
    try {
      if (isLocalMode) {
        loginLocal(role === 'teacher' ? demoTeacher.email : email, role)
        navigate(role === 'teacher' ? '/professor' : course ? `/curso?curso=${course}` : '/curso')
      } else {
        if (role === 'student' && course) sessionStorage.setItem(loginCourseKey, course)
        else sessionStorage.removeItem(loginCourseKey)
        const result = await signInWithGoogle(role)
        if (!result.ok) throw new Error(result.message)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar. Tente novamente.')
    } finally {
      inFlight.current = false
      setBusy(null)
    }
  }

  return <div className="entry-layout">
    <aside className="entry-aside">
      <p className="eyebrow">SEU ESPAÇO DE APRENDIZAGEM</p>
      <div><h2>Há muito a aprender.<br /><em>Comece por aqui.</em></h2><p>Um cenário, uma escolha, uma nova perspectiva. A sua próxima experiência começa agora.</p></div>
      <div className="entry-aside-footer"><Icon name="shield" width="17" height="17" /> Um espaço seguro para praticar.</div>
    </aside>
    <section className="page-card entry-card" aria-labelledby="entry-title">
      <p className="eyebrow">Simulação clínica interprofissional</p>
      <h1 id="entry-title">Como você quer entrar?</h1>
      <p>{teacherFirst ? 'Acesse o espaço do educador para organizar turmas, criar casos e acompanhar debriefings.' : 'Escolha seu perfil e continue sua jornada de aprendizagem.'}</p>
      {course && <p className="entry-course-intent"><Icon name="book" width="17" height="17" /> Sua formação: <strong>{getStudentCourseLabel(course)}</strong></p>}
      {portal.identity && <div className="entry-resume">Você está como <strong>{portal.identity.displayName}</strong>. <Link to={portal.identity.role === 'student' ? '/aluno' : '/professor'}>Continuar no meu espaço →</Link></div>}
      {isLocalMode && <label className="entry-email">E-mail do aluno para experimentar
        <input type="email" list="demo-students" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
        <datalist id="demo-students">{demoStudents.map(student => <option value={student.email} key={student.email}>{student.displayName}</option>)}</datalist>
      </label>}
      <div className={'action-row entry-roles' + (teacherFirst ? ' teacher-first' : '')} aria-busy={busy !== null}>
        <button className="role-button" type="button" disabled={busy !== null} onClick={() => void enter('student')}>
          <span><Icon name="book" /></span><div><strong>{busy === 'student' ? 'Entrando…' : isLocalMode ? 'Sou aluno' : 'Entrar com Google — aluno'}</strong><small>{isLocalMode ? 'Experimentar atividades e casos clínicos.' : 'Entrar com Google e acessar suas atividades.'}</small></div><Icon name="arrow" width="17" height="17" />
        </button>
        <button className="role-button teacher-role" type="button" disabled={busy !== null} onClick={() => void enter('teacher')}>
          <span><Icon name="people" /></span><div><strong>{busy === 'teacher' ? 'Entrando…' : isLocalMode ? 'Sou professor' : 'Entrar com Google — professor'}</strong><small>{isLocalMode ? 'Experimentar a gestão de turmas e casos.' : 'Entrar com Google no espaço do educador.'}</small></div><Icon name="arrow" width="17" height="17" />
        </button>
      </div>
      {(error || portal.error) && <div className="status-message status-error" role="alert"><p>{error || portal.error}</p></div>}
      <Link className="entry-demo-link" to="/demonstracao">Prefere conhecer primeiro? Experimente a demonstração <Icon name="diagonal" width="14" height="14" /></Link>
      <div className="entry-privacy"><Icon name="shield" width="13" height="13" /> {isLocalMode ? 'Demonstração com dados fictícios. As alterações ficam neste navegador.' : 'Entre com sua conta Google para estudar em uma turma ou acessar casos públicos. O acesso docente é liberado pela instituição.'}</div>
    </section>
  </div>
}
