import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { studentCourseOptions } from '../features/onboarding/courses'
import { parseEntryCourse } from '../features/onboarding/entryIntent'
import { getCurrentStudent, updateCurrentStudentCourse } from '../services/student'
import { isLocalMode } from '../lib/dataMode'
import type { StudentCourse } from '../types/database'
import { Icon } from '../components/Icon'

type PageState =
  | { status: 'loading' }
  | { status: 'ready'; course: StudentCourse | null }
  | { status: 'error'; message: string }

const formationDetails = {
  nursing: {
    number: '01',
    area: 'O CUIDADO COMEÇA PELO OLHAR',
    description: 'Conheça a pessoa, compreenda o contexto e pratique as decisões que fazem parte do cuidado.',
    features: ['Acolhimento e segurança', 'Observação e comunicação', 'Decisões centradas na pessoa'],
    icon: 'heart',
  },
  clinical_analysis: {
    number: '02',
    area: 'CADA DETALHE CONTA',
    description: 'Explore o ambiente laboratorial, conectando informações da amostra à análise e à comunicação.',
    features: ['Identificação de amostras', 'Rastreabilidade e protocolos', 'Análise e comunicação'],
    icon: 'flask',
  },
} as const

export function CourseSelectionPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preferredCourse = parseEntryCourse(searchParams.get('curso'))
  const savingRef = useRef(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [pageState, setPageState] = useState<PageState>({ status: 'loading' })
  const [savingCourse, setSavingCourse] = useState<StudentCourse | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function loadStudent() {
      setPageState({ status: 'loading' })
      const result = await getCurrentStudent()
      if (!active) return
      if (!result.ok) {
        if (result.reason === 'not_authenticated') {
          navigate('/entrar', { replace: true })
          return
        }
        setPageState({ status: 'error', message: result.message })
        return
      }
      setPageState({ status: 'ready', course: result.student.course })
    }
    void loadStudent()
    return () => { active = false }
  }, [navigate, reloadToken])

  async function saveCourse(course: StudentCourse) {
    if (savingRef.current || pageState.status !== 'ready') return
    savingRef.current = true
    setSavingCourse(course)
    setSaveError(null)
    try {
      const result = await updateCurrentStudentCourse(course)
      if (!result.ok) {
        if (result.reason === 'not_authenticated') {
          navigate('/entrar', { replace: true })
          return
        }
        throw new Error(result.message)
      }
      setPageState({ status: 'ready', course: result.course })
      await navigate('/participacao')
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Não foi possível escolher a formação. Tente novamente.')
    } finally {
      setSavingCourse(null)
      savingRef.current = false
    }
  }

  return (
    <section className="formation-panel" aria-labelledby="course-title">
      <ol className="formation-journey" aria-label="Sua jornada na plataforma">
        <li className="is-complete"><span><Icon name="check" width="13" height="13" /></span>Seu acesso</li>
        <li aria-current="step"><span>02</span>Sua formação</li>
        <li><span>03</span>Seu caminho</li>
      </ol>
      <div className="formation-panel-heading">
        <div><p className="eyebrow">DIFERENTES SABERES, O MESMO CUIDADO</p><h1 id="course-title">Escolha seu curso</h1></div>
        <p>Por onde vamos começar? Escolha sua formação e encontre um espaço para praticar, decidir e aprender.</p>
      </div>

      {pageState.status === 'loading' && <p className="status-message" role="status">Carregando seu perfil…</p>}
      {pageState.status === 'error' && <div className="status-message status-error" role="alert">
        <p>{pageState.message}</p><button className="text-action" onClick={() => setReloadToken(value => value + 1)} type="button">Tentar novamente</button>
      </div>}
      {pageState.status === 'ready' && <div className="formation-choice-grid" role="group" aria-label="Cursos disponíveis" aria-busy={savingCourse !== null}>
        {studentCourseOptions.map(option => {
          const detail = formationDetails[option.value]
          const isSelected = (preferredCourse ?? pageState.course) === option.value
          const isSaving = savingCourse === option.value
          return <article className={'formation-choice-card ' + option.value + (isSelected ? ' is-selected' : '')} key={option.value} aria-labelledby={'formation-' + option.value}>
            <div className="formation-choice-top"><span className="formation-choice-symbol"><Icon name={detail.icon} width="34" height="34" /></span><span className="formation-choice-number">{detail.number}</span></div>
            <p className="formation-choice-area">{detail.area}</p>
            <h2 id={'formation-' + option.value}>{option.label}</h2>
            <p className="formation-choice-description">{detail.description}</p>
            <ul className="formation-choice-features">{detail.features.map(feature => <li key={feature}><Icon name="check" width="15" height="15" />{feature}</li>)}</ul>
            <div className="formation-choice-current">{isSelected && <><span className="status-dot" />{preferredCourse === option.value ? 'Sua escolha na página inicial' : 'Sua formação atual'}</>}</div>
            <button className="formation-choice-action" type="button" aria-pressed={isSelected} disabled={savingCourse !== null} onClick={() => void saveCourse(option.value)}>
              {isSaving ? 'Preparando seu ambiente…' : 'Escolher ' + option.label}<Icon name="arrow" width="18" height="18" />
            </button>
          </article>
        })}
      </div>}
      {saveError && <p className="status-message status-error" role="alert">{saveError}</p>}

      <div className="formation-panel-footer">
        <p><Icon name="shield" width="17" height="17" />{isLocalMode ? 'Demonstração com dados fictícios. Na próxima etapa, escolha uma turma ou pratique com casos públicos.' : 'Sua escolha fica salva. Na próxima etapa, você poderá entrar em uma turma ou praticar por conta própria.'}</p>
        <div><Link to="/aluno">Ver minhas atividades <Icon name="arrow" width="14" height="14" /></Link><Link to="/entrar">Trocar perfil</Link></div>
      </div>
    </section>
  )
}
