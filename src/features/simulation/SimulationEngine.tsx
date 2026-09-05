import { useReducer, useRef } from 'react'
import { getVisibleCaseStepByKey } from '../../services/cases'
import {
  advanceSimulationSession,
  recordSimulationDecision,
  startOrResumeSimulationSession,
} from '../../services/simulationPersistence'
import {
  createInitialSimulationState,
  simulationReducer,
  toSimulationResult,
} from './state'
import { ClinicalSimulationView } from './ui/ClinicalSimulationView'
import './simulation.css'
import type {
  AdvanceSimulationResult,
  CaseStep,
  MinimalSimulationResult,
  SimulationCase,
  SimulationState,
} from './types'

export interface SimulationEngineProps {
  simulationCase: SimulationCase
  onComplete: (result: MinimalSimulationResult) => void
}

export function SimulationEngine({
  simulationCase,
  onComplete,
}: SimulationEngineProps) {
  const [state, dispatch] = useReducer(
    simulationReducer,
    simulationCase,
    (initialCase) =>
      simulationReducer(createInitialSimulationState(), {
        type: 'loadSucceeded',
        simulationCase: initialCase,
      }),
  )
  const requestInFlight = useRef(false)
  const completionSent = useRef(false)
  const caseId = simulationCase.case.id

  function reportDevelopmentError(message: string, cause: unknown) {
    if (import.meta.env.DEV) {
      console.error(message, cause)
    }
  }

  async function loadPersistedStep(
    currentStepId: string,
    currentStepKey: string,
  ): Promise<CaseStep | null> {
    if (
      simulationCase.firstStep.id === currentStepId &&
      simulationCase.firstStep.stepKey === currentStepKey
    ) {
      return simulationCase.firstStep
    }

    const stepResult = await getVisibleCaseStepByKey(caseId, currentStepKey)

    if (!stepResult.ok) {
      reportDevelopmentError(
        'Falha ao carregar a etapa persistida.',
        stepResult.cause,
      )
      return null
    }

    return stepResult.step.id === currentStepId ? stepResult.step : null
  }

  async function start() {
    if (requestInFlight.current || state.phase !== 'intro') {
      return
    }

    requestInFlight.current = true
    dispatch({ type: 'sessionStartRequested' })

    try {
      const result = await startOrResumeSimulationSession(caseId)

      if (!result.ok) {
        reportDevelopmentError('Falha ao iniciar ou retomar sessão.', result.cause)
        dispatch({
          type: 'sessionStartFailed',
          error: { scope: 'start', message: result.message, cause: result.cause },
        })
        return
      }

      const currentStep = await loadPersistedStep(
        result.session.currentStepId,
        result.session.currentStepKey,
      )

      if (!currentStep) {
        dispatch({
          type: 'sessionStartFailed',
          error: {
            scope: 'start',
            message: 'Não foi possível restaurar a etapa atual. Tente novamente.',
            cause: result.session,
          },
        })
        return
      }

      if (
        result.session.recordedDecision &&
        (currentStep.type !== 'decision' ||
          !currentStep.options.some(
            (option) =>
              option.id === result.session.recordedDecision?.selectedOptionId,
          ))
      ) {
        dispatch({
          type: 'sessionStartFailed',
          error: {
            scope: 'start',
            message: 'A decisão persistida não corresponde à etapa atual.',
            cause: result.session,
          },
        })
        return
      }

      dispatch({ type: 'sessionRestored', session: result.session, currentStep })
    } finally {
      requestInFlight.current = false
    }
  }

  function complete(
    completion: AdvanceSimulationResult,
    transitionState: SimulationState = state,
  ) {
    if (completionSent.current) {
      return
    }

    const completedState = simulationReducer(transitionState, {
      type: 'completed',
      result: completion,
    })
    const result = toSimulationResult(completedState)

    if (!result) {
      dispatch({
        type: 'advanceFailed',
        error: {
          scope: 'advance',
          message: 'A conclusão não retornou uma sessão válida. Tente novamente.',
        },
      })
      return
    }

    completionSent.current = true
    dispatch({ type: 'completed', result: completion })
    onComplete(result)
  }

  async function advanceCurrentStep() {
    const currentStep = state.currentStep
    const sessionId = state.sessionId

    if (!currentStep || !sessionId || requestInFlight.current) {
      return
    }

    if (currentStep.type === 'decision' && !state.evaluation) {
      return
    }

    requestInFlight.current = true
    dispatch({ type: 'advanceRequested' })

    try {
      const advanceResult = await advanceSimulationSession(
        sessionId,
        currentStep.id,
      )

      if (!advanceResult.ok) {
        reportDevelopmentError(
          'Falha ao persistir avanço da simulação.',
          advanceResult.cause,
        )
        dispatch({
          type: 'advanceFailed',
          error: {
            scope: 'advance',
            message: advanceResult.message,
            cause: advanceResult.cause,
          },
        })
        return
      }

      if (advanceResult.result.status === 'completed') {
        complete(advanceResult.result)
        return
      }

      const nextStepResult = await getVisibleCaseStepByKey(
        caseId,
        advanceResult.result.currentStepKey,
      )

      if (
        !nextStepResult.ok ||
        nextStepResult.step.id !== advanceResult.result.currentStepId
      ) {
        const cause = nextStepResult.ok
          ? advanceResult.result
          : nextStepResult.cause
        reportDevelopmentError('Falha ao carregar a próxima etapa.', cause)
        dispatch({
          type: 'advanceFailed',
          error: {
            scope: 'advance',
            message: nextStepResult.ok
              ? 'A próxima etapa retornou um formato inesperado. Tente novamente.'
              : nextStepResult.message,
            cause,
          },
        })
        return
      }

      dispatch({
        type: 'advanceSucceeded',
        step: nextStepResult.step,
        result: advanceResult.result,
      })
    } finally {
      requestInFlight.current = false
    }
  }

  async function persistDecision(optionId: string) {
    const currentStep = state.currentStep
    const sessionId = state.sessionId

    if (
      !currentStep ||
      currentStep.type !== 'decision' ||
      !sessionId ||
      requestInFlight.current ||
      state.phase !== 'step'
    ) {
      return
    }

    requestInFlight.current = true
    dispatch({ type: 'transitionRequested' })

    try {
      const result = await recordSimulationDecision(
        sessionId,
        currentStep.id,
        optionId,
      )

      if (!result.ok) {
        reportDevelopmentError('Falha ao persistir decisão.', result.cause)
        dispatch({
          type: 'transitionFailed',
          error: {
            scope: 'evaluation',
            message: result.message,
            cause: result.cause,
          },
        })
        return
      }

      dispatch({ type: 'decisionRecorded', decision: result.decision })
    } finally {
      requestInFlight.current = false
    }
  }

  function selectOption(optionId: string) {
    if (requestInFlight.current || state.phase !== 'step') {
      return
    }

    dispatch({ type: 'optionSelected', optionId })
    void persistDecision(optionId)
  }

  function retry() {
    if (state.error?.scope === 'start') {
      void start()
      return
    }

    if (state.error?.scope === 'advance') {
      void advanceCurrentStep()
      return
    }

    if (state.currentStep?.type === 'decision' && state.selectedOptionId) {
      void persistDecision(state.selectedOptionId)
    }
  }

  if (state.phase === 'error' || !state.simulationCase || !state.currentStep) {
    return (
      <section className="page-card" aria-labelledby="simulation-engine-title">
        <p className="eyebrow">Simulação</p>
        <h1 id="simulation-engine-title">Não foi possível abrir o caso</h1>
        <div className="status-message status-error" role="alert">
          <p>{state.error?.message ?? 'O conteúdo deste caso está incompleto.'}</p>
        </div>
      </section>
    )
  }

  if (state.phase === 'intro' || state.phase === 'starting') {
    return (
      <ClinicalSimulationView
        busy={state.phase === 'starting'}
        errorMessage={state.error?.message ?? null}
        mode="intro"
        onRetry={retry}
        onStart={() => void start()}
        presentationState={state.presentationState}
        simulationCase={state.simulationCase}
      />
    )
  }

  const busy = state.phase === 'evaluating' || state.phase === 'advancing'
  const canContinueInformation =
    state.currentStep.type === 'information' && state.phase === 'step'
  const canContinueDecision =
    state.currentStep.type === 'decision' && state.phase === 'feedback'

  return (
    <ClinicalSimulationView
      busy={busy}
      errorMessage={state.error?.message ?? null}
      evaluation={state.evaluation}
      mode="step"
      onContinue={() => void advanceCurrentStep()}
      onRetry={retry}
      onSelectOption={selectOption}
      presentationState={state.presentationState}
      selectedOptionId={state.selectedOptionId}
      showContinue={canContinueInformation || canContinueDecision}
      simulationCase={state.simulationCase}
      status={
        state.phase === 'evaluating' || state.phase === 'advancing'
          ? state.phase
          : null
      }
      step={state.currentStep}
      stepNumber={state.stepNumber}
    />
  )
}
