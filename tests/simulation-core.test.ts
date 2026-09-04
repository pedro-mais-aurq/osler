import { describe, expect, it } from 'vitest'
import {
  createInitialSimulationState,
  simulationReducer,
  toSimulationResult,
} from '../src/features/simulation/state'
import type {
  CaseStep,
  SimulationCase,
  SimulationState,
  SimulationTransition,
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

function readyState(firstStep: CaseStep = informationStep): SimulationState {
  const loaded = simulationReducer(createInitialSimulationState(), {
    type: 'loadSucceeded',
    simulationCase: makeCase(firstStep.caseId, 'nursing', firstStep),
  })

  return simulationReducer(loaded, { type: 'started' })
}

function evaluatedState(scoreDelta: number): SimulationState {
  let state = readyState(decisionStep)
  state = simulationReducer(state, { type: 'optionSelected', optionId: 'option-a' })
  state = simulationReducer(state, { type: 'transitionRequested' })

  return simulationReducer(state, {
    type: 'transitionSucceeded',
    transition: {
      evaluation: {
        classification: 'acceptable',
        scoreDelta,
        feedback: 'Selected feedback.',
        consequence: null,
      },
      nextStepKey: 'next-step',
      completed: false,
      presentationState: null,
    },
  })
}

describe('núcleo puro da simulação', () => {
  it('cria o estado inicial estável e sem conteúdo', () => {
    expect(createInitialSimulationState()).toMatchObject({
      phase: 'idle',
      simulationCase: null,
      currentStep: null,
      selectedOptionId: null,
      score: 0,
      decisionCount: 0,
      presentationState: 'stable',
    })
  })

  it('representa carregamento e recebe somente a primeira etapa', () => {
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
    expect(loaded.stepNumber).toBe(1)
  })

  it('inicia o caso sem alterar pontuação ou apresentação', () => {
    const simulationCase = makeCase('case-start', 'nursing')
    const loaded = simulationReducer(createInitialSimulationState(), {
      type: 'loadSucceeded',
      simulationCase,
    })
    const started = simulationReducer(loaded, { type: 'started' })

    expect(started.phase).toBe('step')
    expect(started.score).toBe(0)
    expect(started.presentationState).toBe('stable')
  })

  it('resolve etapa informativa sem avaliação e prepara a próxima chave', () => {
    const transition: SimulationTransition = {
      evaluation: null,
      nextStepKey: 'decision-b',
      completed: false,
      presentationState: 'warning',
    }
    const requested = simulationReducer(readyState(), {
      type: 'transitionRequested',
    })
    const resolved = simulationReducer(requested, {
      type: 'transitionSucceeded',
      transition,
    })

    expect(requested.phase).toBe('advancing')
    expect(resolved.pendingTransition?.nextStepKey).toBe('decision-b')
    expect(resolved.evaluation).toBeNull()
    expect(resolved.score).toBe(0)
  })

  it('entra em avaliação para uma decisão e exibe feedback no sucesso', () => {
    let state = readyState(decisionStep)
    state = simulationReducer(state, { type: 'optionSelected', optionId: 'option-a' })
    state = simulationReducer(state, { type: 'transitionRequested' })

    expect(state.phase).toBe('evaluating')

    state = simulationReducer(state, {
      type: 'transitionSucceeded',
      transition: {
        evaluation: {
          classification: 'ideal',
          scoreDelta: 2,
          feedback: 'Feedback visible.',
          consequence: 'Consequence visible.',
        },
        nextStepKey: 'next-step',
        completed: false,
        presentationState: null,
      },
    })

    expect(state.phase).toBe('feedback')
    expect(state.evaluation?.feedback).toBe('Feedback visible.')
    expect(state.evaluation?.consequence).toBe('Consequence visible.')
    expect(state.decisionCount).toBe(1)
  })

  it.each([
    ['positivo', 3, 3],
    ['zero', 0, 0],
    ['negativo', -2, -2],
  ])('aplica delta %s sem inferir estado visual', (_label, delta, expected) => {
    const state = evaluatedState(delta)

    expect(state.score).toBe(expected)
    expect(state.presentationState).toBe('warning')
  })

  it('aplica estado visual explícito de uma ramificação, independente do score', () => {
    let state = readyState(decisionStep)
    state = simulationReducer(state, { type: 'optionSelected', optionId: 'option-b' })
    state = simulationReducer(state, { type: 'transitionRequested' })
    state = simulationReducer(state, {
      type: 'transitionSucceeded',
      transition: {
        evaluation: {
          classification: 'unsafe',
          scoreDelta: 5,
          feedback: 'Explicit projection.',
          consequence: null,
        },
        nextStepKey: 'branch-target',
        completed: false,
        presentationState: 'critical',
      },
    })

    expect(state.score).toBe(5)
    expect(state.presentationState).toBe('critical')
    expect(state.pendingTransition?.nextStepKey).toBe('branch-target')
  })

  it('representa conclusão e produz o resumo mínimo', () => {
    const state = simulationReducer(evaluatedState(2), { type: 'completed' })

    expect(state.phase).toBe('completed')
    expect(toSimulationResult(state)).toMatchObject({
      caseId: 'case-a',
      score: 2,
      decisionCount: 1,
    })
  })

  it('recupera erro de avaliação preservando a seleção para retry', () => {
    let state = readyState(decisionStep)
    state = simulationReducer(state, { type: 'optionSelected', optionId: 'option-a' })
    state = simulationReducer(state, { type: 'transitionRequested' })
    state = simulationReducer(state, {
      type: 'transitionFailed',
      error: { scope: 'evaluation', message: 'Evaluation failed.' },
    })

    expect(state.phase).toBe('step')
    expect(state.selectedOptionId).toBe('option-a')
    expect(state.error?.scope).toBe('evaluation')
  })

  it('recupera erro de avanço sem descartar feedback ou transição', () => {
    const evaluated = evaluatedState(1)
    const state = simulationReducer(evaluated, {
      type: 'advanceFailed',
      error: { scope: 'advance', message: 'Advance failed.' },
    })

    expect(state.phase).toBe('feedback')
    expect(state.evaluation?.feedback).toBe('Selected feedback.')
    expect(state.pendingTransition?.nextStepKey).toBe('next-step')
  })

  it('reseta seleção, avaliação e erro ao carregar a etapa escolhida', () => {
    const evaluated = evaluatedState(1)
    const advanced = simulationReducer(evaluated, {
      type: 'advanceSucceeded',
      step: { ...informationStep, id: 'next-step', stepKey: 'next-step' },
    })

    expect(advanced.phase).toBe('step')
    expect(advanced.selectedOptionId).toBeNull()
    expect(advanced.evaluation).toBeNull()
    expect(advanced.pendingTransition).toBeNull()
    expect(advanced.stepNumber).toBe(2)
  })

  it('usa o mesmo estado e reducer para fixtures, ids e cursos diferentes', () => {
    const cases = [
      makeCase('fixture-a', 'nursing'),
      makeCase('fixture-b', 'clinical_analysis'),
    ]

    const states = cases.map((simulationCase) => {
      const loaded = simulationReducer(createInitialSimulationState(), {
        type: 'loadSucceeded',
        simulationCase,
      })
      return simulationReducer(loaded, { type: 'started' })
    })

    expect(states.map((state) => state.phase)).toEqual(['step', 'step'])
    expect(states.map((state) => state.simulationCase?.case.id)).toEqual([
      'fixture-a',
      'fixture-b',
    ])
    expect(states.map((state) => state.score)).toEqual([0, 0])
  })
})
