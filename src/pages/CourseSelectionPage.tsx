import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { studentCourseOptions } from '../features/onboarding/courses'
import { getCurrentStudent, updateCurrentStudentCourse } from '../services/student'
import type { StudentCourse } from '../types/database'

type PageState =
  | { status: 'loading' }
  | { status: 'ready'; course: StudentCourse | null }
  | { status: 'error'; message: string }

export function CourseSelectionPage() {
  const navigate = useNavigate()
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

      if (!active) {
        return
      }

      if (!result.ok) {
        if (result.reason === 'not_authenticated') {
          navigate('/', { replace: true })
          return
        }

        if (import.meta.env.DEV) {
          console.error('Falha ao carregar curso.', result.cause)
        }

        setPageState({ status: 'error', message: result.message })
        return
      }

      setPageState({ status: 'ready', course: result.student.course })
    }

    void loadStudent()

    return () => {
      active = false
    }
  }, [navigate, reloadToken])

  async function saveCourse(course: StudentCourse) {
    if (savingRef.current || pageState.status !== 'ready') {
      return
    }

    savingRef.current = true
    setSavingCourse(course)
    setSaveError(null)

    const result = await updateCurrentStudentCourse(course)

    if (!result.ok) {
      if (result.reason === 'not_authenticated') {
        navigate('/', { replace: true })
        return
      }

      if (import.meta.env.DEV) {
        console.error('Falha ao salvar curso.', result.cause)
      }

      setSaveError(result.message)
      setSavingCourse(null)
      savingRef.current = false
      return
    }

    setPageState({ status: 'ready', course: result.course })
    navigate('/simulacao')
  }

  return (
    <section className="page-card" aria-labelledby="course-title">
      <p className="eyebrow">Perfil do estudante</p>
      <h1 id="course-title">Escolha seu curso</h1>
      <p>Essa escolha fica salva e pode ser alterada quando você voltar a esta página.</p>

      {pageState.status === 'loading' ? (
        <p className="status-message" role="status">
          Carregando seu perfil…
        </p>
      ) : null}

      {pageState.status === 'error' ? (
        <div className="status-message status-error" role="alert">
          <p>{pageState.message}</p>
          <div className="inline-actions">
            <button
              className="text-action"
              onClick={() => setReloadToken((value) => value + 1)}
              type="button"
            >
              Tentar novamente
            </button>
            <Link to="/">Voltar à entrada</Link>
          </div>
        </div>
      ) : null}

      {pageState.status === 'ready' ? (
        <div className="course-options" aria-label="Cursos disponíveis">
          {studentCourseOptions.map((option) => {
            const isCurrent = pageState.course === option.value
            const isSaving = savingCourse === option.value

            return (
              <button
                aria-pressed={isCurrent}
                className={isCurrent ? 'course-option selected' : 'course-option'}
                disabled={savingCourse !== null}
                key={option.value}
                onClick={() => saveCourse(option.value)}
                type="button"
              >
                <span>{option.label}</span>
                <small>
                  {isSaving ? 'Salvando…' : isCurrent ? 'Curso atual' : 'Selecionar'}
                </small>
              </button>
            )
          })}
        </div>
      ) : null}

      {saveError ? (
        <p className="status-message status-error" role="alert">
          {saveError}
        </p>
      ) : null}

      <div className="action-row">
        <Link className="secondary-action" to="/">
          Voltar à entrada
        </Link>
      </div>
    </section>
  )
}
