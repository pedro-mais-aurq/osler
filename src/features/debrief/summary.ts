import type { StepClassification } from '../simulation/types'
import type {
  DebriefClassificationCounts,
  DebriefDecision,
  DebriefSummary,
} from './types'

export const debriefClassificationLabels: Record<StepClassification, string> = {
  ideal: 'Muito adequada',
  acceptable: 'Adequada',
  needs_improvement: 'Ponto de melhoria',
  unsafe: 'Atenção de segurança',
}

export function isWellConducted(classification: StepClassification): boolean {
  return classification === 'ideal' || classification === 'acceptable'
}

export function createDebriefSummary(
  scoreTotal: number,
  decisions: DebriefDecision[],
): DebriefSummary {
  const classifications: DebriefClassificationCounts = {
    ideal: 0,
    acceptable: 0,
    needsImprovement: 0,
    unsafe: 0,
  }

  for (const decision of decisions) {
    switch (decision.classification) {
      case 'ideal':
        classifications.ideal += 1
        break
      case 'acceptable':
        classifications.acceptable += 1
        break
      case 'needs_improvement':
        classifications.needsImprovement += 1
        break
      case 'unsafe':
        classifications.unsafe += 1
        break
    }
  }

  return {
    scoreTotal,
    decisionCount: decisions.length,
    classifications,
  }
}
