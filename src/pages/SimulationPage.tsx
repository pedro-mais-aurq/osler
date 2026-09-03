import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getStudentCourseLabel } from '../features/onboarding/courses'
import {
  getNextVisibleCaseStep,
  getSimulationCase,
  resolvePublishedCaseForCourse,
} from '../services/cases'
import { evaluateCaseStep } from '../services/simulation'
import { getCurrentStudent } from '../services/student'
import type {
  MinimalSimulationResult,
  SimulationCase,
  StepClassification,
  StepEvaluation,
  StudentCourse,
} from '../types/database'

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty'; course: StudentCourse }
  | { status: 'ready'; simulationCase: SimulationCase }

const classificationLabels: Record<StepClassification, string> = {
  ideal: 'Escolha ideal',
  acceptable: 'Escolha aceitável',
  needs_improvement: 'Pode melhorar',
  unsafe: 'Escolha insegura',
}

export function SimulationPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedCaseId = searchParams.get('case')
  const evaluationInFlight = useRef(false)
  const advancementInFlight = useRef(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [pageState, setPageState] = useState<PageState>({ status: 'loading' })
  const [started, setStarted] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [decisionCount, setDecisionCount] = useState(0)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [evaluation, setEvaluation] = useState<StepEvaluation | null>(null)
  const [evaluationError, setEvaluationError] = useState<string | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [advancementError, setAdvancementError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadSimulation() {
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

      if (course !== 'nursing') {
        if (requestedCaseId) {
          setSearchParams({}, { replace: true })
        }
        setPageState({ status: 'empty', course })
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

      setStarted(false)
      setStepIndex(0)
      setScore(0)
      setDecisionCount(0)
      setSelectedOptionId(null)
      setEvaluation(null)
      setEvaluationError(null)
      setAdvancementError(null)
      setPageState({ status: 'ready', simulationCase: simulationResult.simulationCase })
    }

    void loadSimulation()

    return () => {
      active = false
    }
  }, [navigate, reloadToken, requestedCaseId, setSearchParams])

  async function evaluateSelection(optionId: string) {
    if (evaluationInFlight.current || pageState.status !== 'ready') {
      return
    }

    const currentStep = pageState.simulationCase.steps[stepIndex]

    if (!currentStep || currentStep.step_type !== 'decision' || evaluation) {
      return
    }

    evaluationInFlight.current = true
    setIsEvaluating(true)
    setSelectedOptionId(optionId)
    setEvaluationError(null)

    const result = await evaluateCaseStep(
      pageState.simulationCase.case.id,
      currentStep.id,
      optionId,
    )

    evaluationInFlight.current = false
    setIsEvaluating(false)

    if (!result.ok) {
      if (import.meta.env.DEV) {
        console.error('Falha ao avaliar escolha da simulação.', result.cause)
      }

      setEvaluationError(result.message)
      return
    }

    setEvaluation(result.evaluation)
    setScore((currentScore) => currentScore + result.evaluation.scoreDelta)
    setDecisionCount((count) => count + 1)
  }

  async function continueSimulation() {
    if (pageState.status !== 'ready' || advancementInFlight.current) {
      return
    }

    const currentStep = pageState.simulationCase.steps[stepIndex]

    if (!currentStep || (currentStep.step_type === 'decision' && !evaluation)) {
      return
    }

    advancementInFlight.current = true
    setIsAdvancing(true)
    setAdvancementError(null)

    const nextStepResult = await getNextVisibleCaseStep(
      pageState.simulationCase.case.id,
      currentStep.position,
    )

    advancementInFlight.current = false
    setIsAdvancing(false)

    if (!nextStepResult.ok) {
      if (import.meta.env.DEV) {
        console.error('Falha ao carregar próxima etapa.', nextStepResult.cause)
      }

      setAdvancementError(nextStepResult.message)
      return
    }

    if (!nextStepResult.step) {
      const result: MinimalSimulationResult = {
        caseId: pageState.simulationCase.case.id,
        caseTitle: pageState.simulationCase.case.title,
        score,
        decisionCount,
      }

      navigate('/resultado', { state: result })
      return
    }

    setPageState((currentPageState) => {
      if (currentPageState.status !== 'ready') {
        return currentPageState
      }

      return {
        status: 'ready',
        simulationCase: {
          ...currentPageState.simulationCase,
          steps: [...currentPageState.simulationCase.steps, nextStepResult.step!],
        },
      }
    })
    setStepIndex((index) => index + 1)
    setSelectedOptionId(null)
    setEvaluation(null)
    setEvaluationError(null)
  }

  if (pageState.status === 'loading') {
    return (
      <section className="page-card" aria-labelledby="simulation-title">
        <p className="eyebrow">Simulação</p>
        <h1 id="simulation-title">Preparando seu caso</h1>
        <p className="status-message" role="status">
          Carregando paciente e etapas…
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

  const { case: clinicalCase, patient, steps } = pageState.simulationCase

  if (!started) {
    return (
      <section className="page-card simulation-intro" aria-labelledby="simulation-title">
        <p className="eyebrow">Caso de {getStudentCourseLabel(clinicalCase.course)}</p>
        <h1 id="simulation-title">{clinicalCase.title}</h1>
        <p>{clinicalCase.description}</p>

        <div className="patient-summary" aria-label="Resumo do paciente">
          <p className="status-label">Paciente</p>
          <h2>{patient.display_name}</h2>
          <dl className="case-details">
            {patient.age_years !== null ? (
              <div>
                <dt>Idade</dt>
                <dd>{patient.age_years} anos</dd>
              </div>
            ) : null}
            {patient.sex_or_anatomy_context ? (
              <div>
                <dt>Contexto</dt>
                <dd>{patient.sex_or_anatomy_context}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {clinicalCase.educational_objective ? (
          <div className="learning-objective">
            <p className="status-label">Objetivo educacional</p>
            <p>{clinicalCase.educational_objective}</p>
          </div>
        ) : null}

        <div className="action-row">
          <button className="primary-action" onClick={() => setStarted(true)} type="button">
            Iniciar caso
          </button>
          <Link className="secondary-action" to="/curso">
            Trocar curso
          </Link>
        </div>
      </section>
    )
  }

  const currentStep = steps[stepIndex]
  const isDecision = currentStep.step_type === 'decision'
  const canContinue = !isDecision || evaluation !== null

  return (
    <section className="page-card simulation-step" aria-labelledby="step-title">
      <div className="step-progress" aria-label={`Etapa ${stepIndex + 1}`}>
        <span>Etapa {stepIndex + 1}</span>
      </div>

      <p className="eyebrow">{clinicalCase.title}</p>
      <h1 id="step-title">{currentStep.title ?? 'Continuação do caso'}</h1>
      <p>{currentStep.content.body}</p>

      {currentStep.content.observations.length > 0 ? (
        <ul className="observation-list">
          {currentStep.content.observations.map((observation) => (
            <li key={observation}>{observation}</li>
          ))}
        </ul>
      ) : null}

      {isDecision ? (
        <div className="decision-options" aria-busy={isEvaluating} aria-label="Opções de decisão">
          {currentStep.options.map((option) => (
            <button
              className={`decision-option${selectedOptionId === option.id ? ' selected' : ''}`}
              disabled={isEvaluating || evaluation !== null}
              key={option.id}
              onClick={() => void evaluateSelection(option.id)}
              type="button"
            >
              <span>{option.label}</span>
              {selectedOptionId === option.id ? (
                <strong className="decision-selection-label">Opção escolhida</strong>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {isEvaluating ? (
        <p className="status-message" role="status">
          Avaliando sua escolha…
        </p>
      ) : null}

      {evaluationError ? (
        <div className="status-message status-error" role="alert">
          <p>{evaluationError}</p>
          {selectedOptionId ? (
            <button
              className="text-action"
              onClick={() => void evaluateSelection(selectedOptionId)}
              type="button"
            >
              Tentar avaliar novamente
            </button>
          ) : null}
        </div>
      ) : null}

      {evaluation ? (
        <div className={`evaluation-feedback ${evaluation.classification}`} role="status">
          <p className="status-label">
            {classificationLabels[evaluation.classification]}
          </p>
          <p>{evaluation.feedback}</p>
          {evaluation.consequence ? <p>{evaluation.consequence}</p> : null}
        </div>
      ) : null}

      {advancementError ? (
        <div className="status-message status-error" role="alert">
          <p>{advancementError}</p>
        </div>
      ) : null}

      {canContinue ? (
        <div className="action-row">
          <button
            className="primary-action"
            disabled={isAdvancing}
            onClick={() => void continueSimulation()}
            type="button"
          >
            {isAdvancing ? 'Carregando próxima etapa…' : 'Continuar'}
          </button>
        </div>
      ) : null}
    </section>
  )
}
