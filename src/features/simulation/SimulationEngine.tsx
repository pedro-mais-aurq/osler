import { useReducer, useRef } from 'react'
import { getVisibleCaseStepByKey } from '../../services/cases'
import { resolveSimulationTransition } from '../../services/simulation'
import {
  createInitialSimulationState,
  simulationReducer,
  toSimulationResult,
} from './state'
import { ClinicalSimulationView } from './ui/ClinicalSimulationView'
import './simulation.css'
import type {
  MinimalSimulationResult,
  SimulationCase,
  SimulationTransition,
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

  function complete(transitionState: SimulationState = state) {
    const result = toSimulationResult(transitionState)

    if (!result || completionSent.current) {
      return
    }

    completionSent.current = true
    dispatch({ type: 'completed' })
    onComplete(result)
  }

  async function advanceFromTransition(
    transition: SimulationTransition,
    transitionState: SimulationState = state,
  ) {
    if (transition.completed) {
      complete(transitionState)
      return
    }

    if (!transition.nextStepKey) {
      dispatch({
        type: 'advanceFailed',
        error: {
          scope: 'advance',
          message: 'A próxima etapa não foi informada. Tente novamente.',
        },
      })
      return
    }

    dispatch({ type: 'advanceRequested' })
    const nextStepResult = await getVisibleCaseStepByKey(
      caseId,
      transition.nextStepKey,
    )

    if (!nextStepResult.ok) {
      if (import.meta.env.DEV) {
        console.error('Falha ao carregar a próxima etapa.', nextStepResult.cause)
      }

      dispatch({
        type: 'advanceFailed',
        error: {
          scope: 'advance',
          message: nextStepResult.message,
          cause: nextStepResult.cause,
        },
      })
      return
    }

    dispatch({ type: 'advanceSucceeded', step: nextStepResult.step })
  }

  async function resolveCurrentStep(optionId: string | null) {
    const currentStep = state.currentStep

    if (!currentStep || requestInFlight.current || state.phase !== 'step') {
      return
    }

    if (
      (currentStep.type === 'information' && optionId !== null) ||
      (currentStep.type === 'decision' && optionId === null)
    ) {
      return
    }

    requestInFlight.current = true
    dispatch({ type: 'transitionRequested' })
    const result = await resolveSimulationTransition(caseId, currentStep.id, optionId)

    if (!result.ok) {
      requestInFlight.current = false

      if (import.meta.env.DEV) {
        console.error('Falha ao resolver transição da simulação.', result.cause)
      }

      dispatch({
        type: 'transitionFailed',
        error: {
          scope: currentStep.type === 'decision' ? 'evaluation' : 'advance',
          message: result.message,
          cause: result.cause,
        },
      })
      return
    }

    if (
      (currentStep.type === 'decision' && !result.transition.evaluation) ||
      (currentStep.type === 'information' && result.transition.evaluation)
    ) {
      requestInFlight.current = false
      dispatch({
        type: 'transitionFailed',
        error: {
          scope: currentStep.type === 'decision' ? 'evaluation' : 'advance',
          message: 'A transição retornou um formato inesperado. Tente novamente.',
          cause: result.transition,
        },
      })
      return
    }

    dispatch({ type: 'transitionSucceeded', transition: result.transition })

    if (currentStep.type === 'information') {
      const nextState = simulationReducer(state, {
        type: 'transitionSucceeded',
        transition: result.transition,
      })
      await advanceFromTransition(result.transition, nextState)
    }

    requestInFlight.current = false
  }

  function selectOption(optionId: string) {
    dispatch({ type: 'optionSelected', optionId })
    void resolveCurrentStep(optionId)
  }

  function continueAfterFeedback() {
    if (!state.pendingTransition || requestInFlight.current) {
      return
    }

    requestInFlight.current = true
    void advanceFromTransition(state.pendingTransition).finally(() => {
      requestInFlight.current = false
    })
  }

  function retry() {
    if (state.error?.scope === 'advance' && state.pendingTransition) {
      continueAfterFeedback()
      return
    }

    if (state.currentStep?.type === 'decision' && state.selectedOptionId) {
      void resolveCurrentStep(state.selectedOptionId)
      return
    }

    void resolveCurrentStep(null)
  }

  if (state.phase === 'error' || !state.simulationCase || !state.currentStep) {
    return (
      <section className="page-card" aria-labelledby="simulation-engine-title">
        <p className="eyebrow">Simulação</p>
        <h1 id="simulation-engine-title">Não foi possível abrir o caso</h1>
        <div className="status-message status-error" role="alert">
          <p>{state.error?.message ?? 'O conteúdo deste caso está incompleto.'}</p>
          <button className="text-action" onClick={retry} type="button">
            Tentar novamente
          </button>
        </div>
      </section>
    )
  }

  if (state.phase === 'intro') {
    return (
      <ClinicalSimulationView
        mode="intro"
        onStart={() => dispatch({ type: 'started' })}
        presentationState={state.presentationState}
        simulationCase={state.simulationCase}
      />
    )
  }

  const busy = state.phase === 'evaluating' || state.phase === 'advancing'
  const canContinueInformation =
    state.currentStep.type === 'information' && state.pendingTransition === null
  const canContinueDecision =
    state.currentStep.type === 'decision' && state.phase === 'feedback'
  const continueCurrentStep = canContinueDecision
    ? continueAfterFeedback
    : () => void resolveCurrentStep(null)

  return (
    <ClinicalSimulationView
      busy={busy}
      errorMessage={state.error?.message ?? null}
      evaluation={state.evaluation}
      mode="step"
      onContinue={continueCurrentStep}
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
