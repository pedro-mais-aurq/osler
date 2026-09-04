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
import type { StudentCourse } from '../types/database'

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty'; course: StudentCourse }
  | { status: 'ready'; simulationCase: SimulationCase }

export function SimulationPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedCaseId = searchParams.get('case')
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
          navigate('/', { replace: true })
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

      const caseResult = await resolvePublishedCaseForCourse(course, requestedCaseId)

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

      if (requestedCaseId !== caseResult.case.id) {
        setSearchParams({ case: caseResult.case.id }, { replace: true })
        return
      }

      const simulationResult = await getSimulationCase(caseResult.case.id, course)

      if (!active) {
        return
      }

      if (!simulationResult.ok) {
        if (import.meta.env.DEV) {
          console.error('Falha ao carregar conteúdo da simulação.', simulationResult.cause)
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
  }, [navigate, reloadToken, requestedCaseId, setSearchParams])

  function handleComplete(result: MinimalSimulationResult) {
    navigate('/resultado', { state: result })
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
            <Link className="secondary-action" to="/">
              Voltar à entrada
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <SimulationEngine
      onComplete={handleComplete}
      simulationCase={pageState.simulationCase}
    />
  )
}
