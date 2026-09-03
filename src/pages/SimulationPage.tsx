import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getStudentCourseLabel } from '../features/onboarding/courses'
import { resolvePublishedCaseForCourse } from '../services/cases'
import { getCurrentStudent } from '../services/student'
import type { ClinicalCaseHandoff, StudentCourse } from '../types/database'

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty'; course: StudentCourse }
  | { status: 'ready'; case: ClinicalCaseHandoff }

export function SimulationPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedCaseId = searchParams.get('case')
  const [reloadToken, setReloadToken] = useState(0)
  const [pageState, setPageState] = useState<PageState>({ status: 'loading' })

  useEffect(() => {
    let active = true

    async function resolveHandoff() {
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
      }

      setPageState({ status: 'ready', case: caseResult.case })
    }

    void resolveHandoff()

    return () => {
      active = false
    }
  }, [navigate, reloadToken, requestedCaseId, setSearchParams])

  return (
    <section className="page-card" aria-labelledby="simulation-title">
      <p className="eyebrow">Encaminhamento</p>
      <h1 id="simulation-title">Caso do seu curso</h1>

      {pageState.status === 'loading' ? (
        <p className="status-message" role="status">
          Localizando um caso publicado…
        </p>
      ) : null}

      {pageState.status === 'error' ? (
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
      ) : null}

      {pageState.status === 'empty' ? (
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
      ) : null}

      {pageState.status === 'ready' ? (
        <div className="case-handoff">
          <p className="status-label">Caso selecionado</p>
          <h2>{pageState.case.title}</h2>
          <dl className="case-details">
            <div>
              <dt>Curso</dt>
              <dd>{getStudentCourseLabel(pageState.case.course)}</dd>
            </div>
            <div>
              <dt>Descrição</dt>
              <dd>{pageState.case.description}</dd>
            </div>
            {pageState.case.educational_objective ? (
              <div>
                <dt>Objetivo educacional</dt>
                <dd>{pageState.case.educational_objective}</dd>
              </div>
            ) : null}
          </dl>
          <p className="scope-note">A simulação será implementada na Parte 4.</p>
          <div className="action-row">
            <Link className="secondary-action" to="/curso">
              Trocar curso
            </Link>
            <Link className="secondary-action" to="/">
              Voltar à entrada
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  )
}
