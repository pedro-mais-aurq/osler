import { describe, expect, it } from 'vitest'
import {
  createInitialSimulationState,
  simulationReducer,
  toSimulationResult,
} from '../src/features/simulation/state'
import type {
  AdvanceSimulationResult,
  CaseStep,
  RecordedSimulationDecision,
  SimulationCase,
  SimulationSessionSnapshot,
  SimulationState,
} from '../src/features/simulation/types'
import type { StudentCourse } from '../src/types/database'

const informationStep: CaseStep = {
  id: 'step-a',
  caseId: 'case-a',
  position: 1,
  stepKey: 'information-a',
  type: 'information',
  title: 'Information A',
  content: { body: 'Body A', observations: ['Observation A'] },
  presentationState: 'stable',
}

const decisionStep: CaseStep = {
  id: 'step-b',
  caseId: 'case-a',
  position: 2,
  stepKey: 'decision-b',
  type: 'decision',
  title: 'Decision B',
  content: { body: 'Body B', observations: [] },
  options: [
    { id: 'option-a', label: 'Option A' },
    { id: 'option-b', label: 'Option B' },
  ],
  presentationState: 'warning',
}

const laboratoryInformationStep: CaseStep = {
  ...informationStep,
  id: 'laboratory-step',
  stepKey: 'laboratory-information',
  content: {
    body: 'Laboratory visible body.',
    observations: [],
    laboratory: {
      stage: 'sample',
      title: 'Visible sample',
      fields: [{ label: 'Material', value: 'Whole blood' }],
    },
  },
}

function makeCase(
  id: string,
  course: StudentCourse,
  firstStep: CaseStep = informationStep,
): SimulationCase {
  return {
    case: {
      id,
      slug: `fixture-${id}`,
      title: `Fixture ${id}`,
      description: 'Technical fixture.',
      educationalObjective: null,
      status: 'published',
    },
    patient: {
      id: `patient-${id}`,
      displayName: `Patient ${id}`,
      ageYears: null,
      sexOrAnatomyContext: null,
      pronouns: null,
      visualRef: null,
    },
    firstStep: { ...firstStep, caseId: id },
  }
}

function sessionFor(
  step: CaseStep,
  overrides: Partial<SimulationSessionSnapshot> = {},
): SimulationSessionSnapshot {
  return {
    sessionId: 'session-a',
    caseId: step.caseId,
    status: 'in_progress',
    currentStepId: step.id,
    currentStepKey: step.stepKey,
    scoreTotal: 0,
    decisionCount: 0,
    startedAt: '2026-09-04T20:00:00.000Z',
    resumed: false,
    presentationState: step.presentationState,
    recordedDecision: null,
    ...overrides,
  }
}

function readyState(firstStep: CaseStep = informationStep): SimulationState {
  const loaded = simulationReducer(createInitialSimulationState(), {
    type: 'loadSucceeded',
    simulationCase: makeCase(firstStep.caseId, 'nursing', firstStep),
  })

  return simulationReducer(loaded, {
    type: 'sessionRestored',
    session: sessionFor(firstStep),
    currentStep: firstStep,
  })
}

function recordedDecision(
  scoreTotal: number,
  scoreDelta = scoreTotal,
  presentationState: RecordedSimulationDecision['transition']['presentationState'] = null,
): RecordedSimulationDecision {
  return {
    actionId: 'action-a',
    sessionId: 'session-a',
    stepId: decisionStep.id,
    selectedOptionId: 'option-a',
    transition: {
      evaluation: {
        classification: 'acceptable',
        scoreDelta,
        feedback: 'Selected feedback.',
        consequence: null,
      },
      nextStepKey: 'next-step',
      completed: false,
      presentationState,
    },
    scoreTotal,
    decisionCount: 1,
    createdAt: '2026-09-04T20:01:00.000Z',
    replayed: false,
  }
}

function evaluatedState(scoreTotal: number): SimulationState {
  let state = readyState(decisionStep)
  state = simulationReducer(state, { type: 'optionSelected', optionId: 'option-a' })
  state = simulationReducer(state, { type: 'transitionRequested' })

  return simulationReducer(state, {
    type: 'decisionRecorded',
    decision: recordedDecision(scoreTotal),
  })
}

function advanceResult(
  overrides: Partial<AdvanceSimulationResult> = {},
): AdvanceSimulationResult {
  return {
    sessionId: 'session-a',
    status: 'in_progress',
    currentStepId: 'next-step',
    currentStepKey: 'next-step',
    scoreTotal: 4,
    decisionCount: 2,
    completedAt: null,
    previousStepId: decisionStep.id,
    presentationState: 'recovery',
    replayed: false,
    ...overrides,
  }
}

describe('núcleo puro da simulação persistente', () => {
  it('cria o estado inicial estável, sem conteúdo ou sessão', () => {
    expect(createInitialSimulationState()).toMatchObject({
      phase: 'idle',
      simulationCase: null,
      sessionId: null,
      currentStep: null,
      selectedOptionId: null,
      score: 0,
      decisionCount: 0,
      presentationState: 'stable',
    })
  })

  it('carrega somente a primeira etapa e permanece na introdução', () => {
    const loading = simulationReducer(createInitialSimulationState(), {
      type: 'loadRequested',
    })
    const simulationCase = makeCase('case-load', 'nursing')
    const loaded = simulationReducer(loading, {
      type: 'loadSucceeded',
      simulationCase,
    })

    expect(loading.phase).toBe('loading')
    expect(loaded.phase).toBe('intro')
    expect(loaded.currentStep).toEqual(simulationCase.firstStep)
    expect(loaded.sessionId).toBeNull()
  })

  it('mantém o caso na intro quando o start falha e permite retry', () => {
    const loaded = simulationReducer(createInitialSimulationState(), {
      type: 'loadSucceeded',
      simulationCase: makeCase('case-start', 'nursing'),
    })
    const starting = simulationReducer(loaded, { type: 'sessionStartRequested' })
    const failed = simulationReducer(starting, {
      type: 'sessionStartFailed',
      error: { scope: 'start', message: 'Start failed.' },
    })

    expect(starting.phase).toBe('starting')
    expect(failed.phase).toBe('intro')
    expect(failed.simulationCase).toBe(loaded.simulationCase)
    expect(failed.error?.scope).toBe('start')
  })

  it('restaura step, score e contagem exclusivamente do snapshot server-side', () => {
    const loaded = simulationReducer(createInitialSimulationState(), {
      type: 'loadSucceeded',
      simulationCase: makeCase('case-a', 'nursing'),
    })
    const restored = simulationReducer(loaded, {
      type: 'sessionRestored',
      session: sessionFor(decisionStep, {
        scoreTotal: 7,
        decisionCount: 3,
        resumed: true,
      }),
      currentStep: decisionStep,
    })

    expect(restored.phase).toBe('step')
    expect(restored.sessionId).toBe('session-a')
    expect(restored.currentStep).toBe(decisionStep)
    expect(restored.stepNumber).toBe(2)
    expect(restored.score).toBe(7)
    expect(restored.decisionCount).toBe(3)
  })

  it('restaura feedback persistido e impede uma nova seleção local', () => {
    const decision = recordedDecision(2, 2, 'critical')
    const loaded = simulationReducer(createInitialSimulationState(), {
      type: 'loadSucceeded',
      simulationCase: makeCase('case-a', 'nursing', decisionStep),
    })
    const restored = simulationReducer(loaded, {
      type: 'sessionRestored',
      session: sessionFor(decisionStep, {
        scoreTotal: 2,
        decisionCount: 1,
        resumed: true,
        recordedDecision: {
          selectedOptionId: decision.selectedOptionId,
          transition: decision.transition,
        },
      }),
      currentStep: decisionStep,
    })
    const ignored = simulationReducer(restored, {
      type: 'optionSelected',
      optionId: 'option-b',
    })

    expect(restored.phase).toBe('feedback')
    expect(restored.selectedOptionId).toBe('option-a')
    expect(restored.evaluation?.feedback).toBe('Selected feedback.')
    expect(restored.presentationState).toBe('critical')
    expect(ignored).toBe(restored)
  })

  it('entra em avaliação e aplica totais absolutos devolvidos pelo servidor', () => {
    let state = readyState(decisionStep)
    state = simulationReducer(state, { type: 'optionSelected', optionId: 'option-a' })
    state = simulationReducer(state, { type: 'transitionRequested' })

    expect(state.phase).toBe('evaluating')

    state = simulationReducer(state, {
      type: 'decisionRecorded',
      decision: {
        ...recordedDecision(9, 2),
        decisionCount: 4,
      },
    })

    expect(state.phase).toBe('feedback')
    expect(state.score).toBe(9)
    expect(state.decisionCount).toBe(4)
    expect(state.evaluation?.scoreDelta).toBe(2)
  })

  it.each([
    ['positivo', 3, -20],
    ['zero', 0, 11],
    ['negativo', -2, 5],
  ])(
    'mantém score server-side no cenário de delta %s sem inferir estado visual',
    (_label, delta, total) => {
      let state = readyState(decisionStep)
      state = simulationReducer(state, {
        type: 'decisionRecorded',
        decision: recordedDecision(total, delta, 'critical'),
      })

      expect(state.score).toBe(total)
      expect(state.presentationState).toBe('critical')
    },
  )

  it('preserva seleção após falha de persistência da decisão', () => {
    let state = readyState(decisionStep)
    state = simulationReducer(state, { type: 'optionSelected', optionId: 'option-a' })
    state = simulationReducer(state, { type: 'transitionRequested' })
    state = simulationReducer(state, {
      type: 'transitionFailed',
      error: { scope: 'evaluation', message: 'Persistence failed.' },
    })

    expect(state.phase).toBe('step')
    expect(state.selectedOptionId).toBe('option-a')
    expect(state.sessionId).toBe('session-a')
  })

  it('preserva feedback após falha de avanço persistente', () => {
    const state = simulationReducer(evaluatedState(1), {
      type: 'advanceFailed',
      error: { scope: 'advance', message: 'Advance failed.' },
    })

    expect(state.phase).toBe('feedback')
    expect(state.evaluation?.feedback).toBe('Selected feedback.')
    expect(state.pendingTransition?.nextStepKey).toBe('next-step')
  })

  it('usa step e totais confirmados pelo servidor ao avançar', () => {
    const nextStep: CaseStep = {
      ...informationStep,
      id: 'next-step',
      position: 5,
      stepKey: 'next-step',
      presentationState: 'recovery',
    }
    const advanced = simulationReducer(evaluatedState(1), {
      type: 'advanceSucceeded',
      step: nextStep,
      result: advanceResult(),
    })

    expect(advanced.phase).toBe('step')
    expect(advanced.currentStep).toBe(nextStep)
    expect(advanced.stepNumber).toBe(5)
    expect(advanced.score).toBe(4)
    expect(advanced.decisionCount).toBe(2)
    expect(advanced.selectedOptionId).toBeNull()
    expect(advanced.evaluation).toBeNull()
  })

  it('produz resultado mínimo somente após conclusão server-authoritative', () => {
    const completed = simulationReducer(evaluatedState(2), {
      type: 'completed',
      result: advanceResult({
        status: 'completed',
        scoreTotal: 8,
        decisionCount: 3,
        completedAt: '2026-09-04T20:02:00.000Z',
      }),
    })

    expect(completed.phase).toBe('completed')
    expect(toSimulationResult(completed)).toMatchObject({
      sessionId: 'session-a',
      caseId: 'case-a',
      score: 8,
      decisionCount: 3,
    })
  })

  it('não produz resultado sem sessionId persistido', () => {
    const loaded = simulationReducer(createInitialSimulationState(), {
      type: 'loadSucceeded',
      simulationCase: makeCase('case-a', 'nursing'),
    })

    expect(toSimulationResult(loaded)).toBeNull()
  })

  it('usa o mesmo estado e reducer para Nursing e Clinical Analysis', () => {
    const cases = [
      makeCase('fixture-a', 'nursing'),
      makeCase('fixture-b', 'clinical_analysis', laboratoryInformationStep),
    ]

    const states = cases.map((simulationCase) => {
      const loaded = simulationReducer(createInitialSimulationState(), {
        type: 'loadSucceeded',
        simulationCase,
      })
      return simulationReducer(loaded, {
        type: 'sessionRestored',
        session: sessionFor(simulationCase.firstStep, {
          sessionId: `session-${simulationCase.case.id}`,
          caseId: simulationCase.case.id,
          currentStepId: simulationCase.firstStep.id,
          currentStepKey: simulationCase.firstStep.stepKey,
        }),
        currentStep: simulationCase.firstStep,
      })
    })

    expect(states.map((state) => state.phase)).toEqual(['step', 'step'])
    expect(states.map((state) => state.sessionId)).toEqual([
      'session-fixture-a',
      'session-fixture-b',
    ])
    expect(states[1].currentStep?.content.laboratory?.stage).toBe('sample')
  })
})
