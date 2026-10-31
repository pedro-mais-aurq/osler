import { describe, expect, it } from 'vitest'
import {
  parseCaseStep,
  parseLaboratoryVisibleData,
} from '../src/features/simulation/parsers'
import type { LaboratoryStage } from '../src/features/simulation/types'

const validLaboratory = {
  stage: 'request',
  title: 'Solicitação visível',
  fields: [{ label: 'Exame', value: 'Hemograma automatizado' }],
  notes: ['Nota visível.'],
}

function makeStep(laboratory?: unknown) {
  return {
    id: 'step-laboratory',
    case_id: 'case-clinical-analysis',
    position: 1,
    step_key: 'laboratory-step',
    step_type: 'information',
    title: 'Etapa laboratorial',
    content: {
      body: 'Conteúdo público.',
      observations: [],
      ...(laboratory === undefined ? {} : { laboratory }),
    },
    options: [],
    metadata: { presentation_state: 'stable' },
  }
}

describe('parser do conteúdo laboratorial visível', () => {
  it('preserva etapas sem laboratory para o fluxo de Enfermagem', () => {
    const result = parseCaseStep(makeStep())

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.content.laboratory).toBeUndefined()
    }
  })

  it.each<LaboratoryStage>([
    'request',
    'sample',
    'preanalytical',
    'analysis',
    'result',
  ])('aceita o stage %s', (stage) => {
    expect(parseLaboratoryVisibleData({ ...validLaboratory, stage })).toEqual({
      ...validLaboratory,
      stage,
    })
  })

  it('rejeita stage inválido', () => {
    expect(
      parseLaboratoryVisibleData({ ...validLaboratory, stage: 'hidden-truth' }),
    ).toBeNull()
  })

  it('rejeita field inválido', () => {
    expect(
      parseLaboratoryVisibleData({
        ...validLaboratory,
        fields: [{ label: 'Exame', value: 42 }],
      }),
    ).toBeNull()
  })

  it('rejeita note inválida', () => {
    expect(
      parseLaboratoryVisibleData({ ...validLaboratory, notes: ['Visível', 42] }),
    ).toBeNull()
  })

  it.each([
    'correct',
    'expected',
    'shouldReject',
    'score',
    'classification',
    'hiddenProblem',
    'truth',
    'nextStep',
    'rule',
  ])('rejeita a chave privada %s no payload laboratorial', (privateKey) => {
    const result = parseCaseStep(
      makeStep({ ...validLaboratory, [privateKey]: 'não deve chegar ao cliente' }),
    )

    expect(result.ok).toBe(false)
  })
})
