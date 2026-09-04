import type {
  MinimalSimulationResult,
  SimulationAction,
  SimulationState,
} from './types'

export function createInitialSimulationState(): SimulationState {
  return {
    phase: 'idle',
    simulationCase: null,
    currentStep: null,
    stepNumber: 0,
    selectedOptionId: null,
    evaluation: null,
    pendingTransition: null,
    score: 0,
    decisionCount: 0,
    presentationState: 'stable',
    error: null,
  }
}

export function simulationReducer(
  state: SimulationState,
  action: SimulationAction,
): SimulationState {
  switch (action.type) {
    case 'reset':
      return createInitialSimulationState()
    case 'loadRequested':
      return { ...createInitialSimulationState(), phase: 'loading' }
    case 'loadSucceeded':
      return {
        ...createInitialSimulationState(),
        phase: 'intro',
        simulationCase: action.simulationCase,
        currentStep: action.simulationCase.firstStep,
        stepNumber: 1,
        presentationState: action.simulationCase.firstStep.presentationState,
      }
    case 'loadFailed':
      return {
        ...createInitialSimulationState(),
        phase: 'error',
        error: action.error,
      }
    case 'started':
      return state.phase === 'intro' ? { ...state, phase: 'step' } : state
    case 'optionSelected':
      if (
        state.phase !== 'step' ||
        state.currentStep?.type !== 'decision' ||
        !state.currentStep.options.some((option) => option.id === action.optionId)
      ) {
        return state
      }

      return {
        ...state,
        selectedOptionId: action.optionId,
        evaluation: null,
        pendingTransition: null,
        error: null,
      }
    case 'transitionRequested':
      if (!state.currentStep || state.phase !== 'step') {
        return state
      }

      return {
        ...state,
        phase: state.currentStep.type === 'decision' ? 'evaluating' : 'advancing',
        error: null,
      }
    case 'transitionSucceeded': {
      const evaluation = action.transition.evaluation

      return {
        ...state,
        phase: evaluation ? 'feedback' : 'advancing',
        evaluation,
        pendingTransition: action.transition,
        score: state.score + (evaluation?.scoreDelta ?? 0),
        decisionCount: state.decisionCount + (evaluation ? 1 : 0),
        presentationState:
          action.transition.presentationState ?? state.presentationState,
        error: null,
      }
    }
    case 'transitionFailed':
      return { ...state, phase: 'step', error: action.error }
    case 'advanceRequested':
      return { ...state, phase: 'advancing', error: null }
    case 'advanceSucceeded':
      return {
        ...state,
        phase: 'step',
        currentStep: action.step,
        stepNumber: state.stepNumber + 1,
        selectedOptionId: null,
        evaluation: null,
        pendingTransition: null,
        presentationState:
          state.pendingTransition?.presentationState ?? action.step.presentationState,
        error: null,
      }
    case 'advanceFailed':
      return {
        ...state,
        phase: state.evaluation ? 'feedback' : 'step',
        error: action.error,
      }
    case 'completed':
      return { ...state, phase: 'completed', error: null }
  }
}

export function toSimulationResult(state: SimulationState): MinimalSimulationResult | null {
  if (!state.simulationCase) {
    return null
  }

  return {
    caseId: state.simulationCase.case.id,
    caseTitle: state.simulationCase.case.title,
    score: state.score,
    decisionCount: state.decisionCount,
  }
}
