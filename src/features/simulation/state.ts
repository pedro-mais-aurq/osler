import type {
  MinimalSimulationResult,
  SimulationAction,
  SimulationState,
} from './types'

export function createInitialSimulationState(): SimulationState {
  return {
    phase: 'idle',
    simulationCase: null,
    sessionId: null,
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
    case 'sessionStartRequested':
      return state.phase === 'intro'
        ? { ...state, phase: 'starting', error: null }
        : state
    case 'sessionStartFailed':
      return state.phase === 'starting' || state.phase === 'intro'
        ? { ...state, phase: 'intro', error: action.error }
        : state
    case 'sessionRestored': {
      const restoredDecision = action.session.recordedDecision

      return {
        ...state,
        phase: restoredDecision ? 'feedback' : 'step',
        sessionId: action.session.sessionId,
        currentStep: action.currentStep,
        stepNumber: action.currentStep.position,
        selectedOptionId: restoredDecision?.selectedOptionId ?? null,
        evaluation: restoredDecision?.transition.evaluation ?? null,
        pendingTransition: restoredDecision?.transition ?? null,
        score: action.session.scoreTotal,
        decisionCount: action.session.decisionCount,
        presentationState:
          restoredDecision?.transition.presentationState ??
          action.session.presentationState,
        error: null,
      }
    }
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
    case 'decisionRecorded':
      return {
        ...state,
        phase: 'feedback',
        sessionId: action.decision.sessionId,
        selectedOptionId: action.decision.selectedOptionId,
        evaluation: action.decision.transition.evaluation,
        pendingTransition: action.decision.transition,
        score: action.decision.scoreTotal,
        decisionCount: action.decision.decisionCount,
        presentationState:
          action.decision.transition.presentationState ?? state.presentationState,
        error: null,
      }
    case 'transitionFailed':
      return { ...state, phase: 'step', error: action.error }
    case 'advanceRequested':
      return { ...state, phase: 'advancing', error: null }
    case 'advanceSucceeded':
      return {
        ...state,
        phase: 'step',
        sessionId: action.result.sessionId,
        currentStep: action.step,
        stepNumber: action.step.position,
        selectedOptionId: null,
        evaluation: null,
        pendingTransition: null,
        score: action.result.scoreTotal,
        decisionCount: action.result.decisionCount,
        presentationState:
          action.result.presentationState ?? action.step.presentationState,
        error: null,
      }
    case 'advanceFailed':
      return {
        ...state,
        phase: state.evaluation ? 'feedback' : 'step',
        error: action.error,
      }
    case 'completed':
      return {
        ...state,
        phase: 'completed',
        sessionId: action.result.sessionId,
        score: action.result.scoreTotal,
        decisionCount: action.result.decisionCount,
        presentationState:
          action.result.presentationState ?? state.presentationState,
        error: null,
      }
  }
}

export function toSimulationResult(state: SimulationState): MinimalSimulationResult | null {
  if (!state.simulationCase || !state.sessionId) {
    return null
  }

  return {
    sessionId: state.sessionId,
    caseId: state.simulationCase.case.id,
    caseTitle: state.simulationCase.case.title,
    score: state.score,
    decisionCount: state.decisionCount,
  }
}
