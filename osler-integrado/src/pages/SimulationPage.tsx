import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { SimulationEngine } from '../features/simulation/SimulationEngine'
import type {
  MinimalSimulationResult,
  SimulationCase,
} from '../features/simulation/types'
import { getStudentCourseLabel } from '../features/onboarding/courses'
import {
  getSimulationCase,
  resolvePublishedCaseForCourse,
} from '../services/cases'
import { getCurrentStudent } from '../services/student'
import { getPublicPractice, getStudentWorkspace } from '../services/teaching'
import type { StudentCourse } from '../types/database'
import type { StudentAssignment } from '../features/teaching/types'
import { Icon } from '../components/Icon'

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty'; course: StudentCourse }
  | { status: 'catalogue'; course: StudentCourse; assignments: StudentAssignment[] }
  | { status: 'ready'; simulationCase: SimulationCase }

export function SimulationPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedCaseId = searchParams.get('case')
  const assignmentId = searchParams.get('atividade')
  const independent = searchParams.get('modo') === 'publico'
  const [reloadToken, setReloadToken] = useState(0)
  const [pageState, setPageState] = useState<PageState>({ status: 'loading' })

  useEffect(() => {
    let active = true

    async function resolveCase() {
      setPageState({ status: 'loading' })
      const studentResult = await getCurrentStudent()

      if (!active) {
        return
      }

      if (!studentResult.ok) {
        if (studentResult.reason === 'not_authenticated') {
          navigate('/entrar', { replace: true })
          return
        }

        if (import.meta.env.DEV) {
          console.error('Falha ao validar estudante.', studentResult.cause)
        }

        setPageState({ status: 'error', message: studentResult.message })
        return
      }

      const { course } = studentResult.student

      if (!course) {
        navigate('/curso', { replace: true })
        return
      }

      if (independent) {
        if (assignmentId) { setPageState({ status: 'error', message: 'Escolha uma atividade de turma ou uma prática individual para continuar.' }); return }
        if (!requestedCaseId) { navigate('/casos-publicos', { replace: true }); return }
        const catalogue = await getPublicPractice(course)
        if (!active) return
        if (!catalogue.ok) { setPageState({ status: 'error', message: catalogue.message }); return }
        if (!catalogue.value.cases.some(item => item.id === requestedCaseId)) { setPageState({ status: 'error', message: 'Este caso não está disponível para prática individual.' }); return }
        const result = await getSimulationCase(requestedCaseId, course)
        if (!active) return
        setPageState(result.ok ? { status: 'ready', simulationCase: result.simulationCase } : { status: 'error', message: result.message })
        return
      }

      let availableWorkspace: Awaited<ReturnType<typeof getStudentWorkspace>> | undefined
      if (!requestedCaseId && !assignmentId) {
        availableWorkspace = await getStudentWorkspace()
        if (!active) return
        if (!availableWorkspace.ok) {
          setPageState({ status: 'error', message: availableWorkspace.message })
          return
        }
        const assignments = availableWorkspace.value.assignments.filter(item => item.course === course && item.status === 'open')
        if (assignments.length > 1) {
          setPageState({ status: 'catalogue', course, assignments })
          return
        }
      }

      const caseResult = await resolvePublishedCaseForCourse(
        course,
        requestedCaseId,
      )

      if (!active) {
        return
      }

      if (!caseResult.ok) {
        if (import.meta.env.DEV) {
          console.error('Falha ao resolver caso publicado.', caseResult.cause)
        }

        setPageState({ status: 'error', message: caseResult.message })
        return
      }

      if (!caseResult.case) {
        if (requestedCaseId) {
          setSearchParams({}, { replace: true })
        }
        setPageState({ status: 'empty', course })
        return
      }

      // Entry from the landing or course selector must retain the classroom
      // assignment. Teacher-authored cases cannot start without that context.
      if (!assignmentId) {
        const workspace = availableWorkspace ?? await getStudentWorkspace()
        if (!active) return
        if (!workspace.ok) {
          setPageState({ status: 'error', message: workspace.message })
          return
        }
        const assignment = workspace.value.assignments.find(
          item => item.caseId === caseResult.case!.id && item.course === course && item.status === 'open',
        )
        if (assignment) {
          setSearchParams(previous => {
            const next = new URLSearchParams(previous)
            next.set('case', assignment.caseId)
            next.set('atividade', assignment.id)
            return next
          }, { replace: true })
          return
        }
      }

      if (requestedCaseId !== caseResult.case.id) {
        setSearchParams(
          (previous) => {
            const next = new URLSearchParams(previous)
            next.set('case', caseResult.case!.id)
            return next
          },
          { replace: true },
        )
        return
      }

      const simulationResult = await getSimulationCase(
        caseResult.case.id,
        course,
      )

      if (!active) {
        return
      }

      if (!simulationResult.ok) {
        if (import.meta.env.DEV) {
          console.error(
            'Falha ao carregar conteúdo da simulação.',
            simulationResult.cause,
          )
        }

        setPageState({ status: 'error', message: simulationResult.message })
        return
      }

      setPageState({
        status: 'ready',
        simulationCase: simulationResult.simulationCase,
      })
    }

    void resolveCase()

    return () => {
      active = false
    }
  }, [navigate, reloadToken, requestedCaseId, assignmentId, independent, setSearchParams])

  function handleComplete(result: MinimalSimulationResult) {
    navigate(
      `/resultado?session=${encodeURIComponent(result.sessionId)}${assignmentId ? `&atividade=${encodeURIComponent(assignmentId)}` : ''}`,
    )
  }

  if (pageState.status === 'loading') {
    return (
      <section className="page-card" aria-labelledby="simulation-title">
        <p className="eyebrow">Simulação</p>
        <h1 id="simulation-title">Preparando seu caso</h1>
        <p className="status-message" role="status">
          Validando acesso e caso publicado…
        </p>
      </section>
    )
  }

  if (pageState.status === 'error') {
    return (
      <section className="page-card" aria-labelledby="simulation-title">
        <p className="eyebrow">Simulação</p>
        <h1 id="simulation-title">Não foi possível abrir o caso</h1>
        <div className="status-message status-error" role="alert">
          <p>{pageState.message}</p>
          <button
            className="text-action"
            onClick={() => setReloadToken((value) => value + 1)}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      </section>
    )
  }

  if (pageState.status === 'empty') {
    return (
      <section className="page-card" aria-labelledby="simulation-title">
        <p className="eyebrow">Simulação</p>
        <h1 id="simulation-title">Caso do seu curso</h1>
        <div className="empty-state">
          <p>
            Nenhum caso publicado está disponível para{' '}
            {getStudentCourseLabel(pageState.course)} neste momento.
          </p>
          <div className="action-row">
            <Link className="primary-action" to="/curso">
              Trocar curso
            </Link>
            <Link className="secondary-action" to="/aluno">
              Voltar à entrada
            </Link>
            <Link className="secondary-action" to="/participacao">Entrar em uma turma</Link>
            <Link className="secondary-action" to="/casos-publicos">Explorar casos públicos</Link>
          </div>
        </div>
      </section>
    )
  }

  if (pageState.status === 'catalogue') {
    return <section className="clinical-case-catalogue" aria-labelledby="catalogue-title">
      <div className="case-catalogue-heading"><div><p className="eyebrow">{getStudentCourseLabel(pageState.course)} · SEU ESPAÇO DE PRÁTICA</p><h1 id="catalogue-title">Escolha seu próximo caso</h1><p>Conheça o contexto, acompanhe as etapas e reflita sobre cada decisão.</p></div><Link className="secondary-action" to="/curso">Trocar formação <Icon name="arrow" width="16" height="16" /></Link></div>
      <div className="clinical-case-grid">{pageState.assignments.map(assignment => <article className="clinical-case-card" aria-labelledby={'case-' + assignment.id} key={assignment.id}>
        <div className="clinical-case-meta"><Icon name={pageState.course === 'nursing' ? 'heart' : 'flask'} width="24" height="24" /><span>{assignment.stepCount ? `${assignment.stepCount} etapas · ${assignment.expectedDecisions} decisões` : 'Caso clínico educacional'}</span></div>
        <p className="eyebrow">{assignment.title}</p><h2 id={'case-' + assignment.id}>{assignment.caseTitle}</h2><p>{assignment.description}</p>
        <div className="clinical-case-objective"><strong>O que vamos explorar</strong><p>{assignment.objective}</p></div>
        <p className="clinical-case-classroom">{assignment.classroomName}</p>
        <button className="primary-action" type="button" aria-label={'Abrir caso: ' + assignment.caseTitle} onClick={() => setSearchParams({ case: assignment.caseId, atividade: assignment.id })}>Explorar este caso <Icon name="arrow" width="17" height="17" /></button>
      </article>)}</div>
      <Link className="case-catalogue-activities" to="/aluno">Ver minhas atividades e tentativas <Icon name="arrow" width="15" height="15" /></Link>
      <Link className="case-catalogue-activities" to="/casos-publicos">Praticar sem turma <Icon name="arrow" width="15" height="15" /></Link>
    </section>
  }

  return (
    <SimulationEngine
      assignmentId={assignmentId}
      onComplete={handleComplete}
      simulationCase={pageState.simulationCase}
    />
  )
}
