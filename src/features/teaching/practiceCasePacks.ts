import type { PracticeCaseDefinition } from './caseContent'
import { extendedDemoCaseDefinitions, extendedDemoPack } from './extendedDemoCases'
import { respiratoryDeterioration } from './practiceCases/respiratoryDeterioration'
import { inpatientHypoglycemia } from './practiceCases/inpatientHypoglycemia'
import { inpatientFall } from './practiceCases/inpatientFall'
import { positiveBloodCultures } from './practiceCases/positiveBloodCultures'
import { citrateTubeVolume } from './practiceCases/citrateTubeVolume'
import { glucoseQualityControl } from './practiceCases/glucoseQualityControl'

export const largePracticeCasePack = {
  id: 'osler-six-practice-cases-v1',
  definitions: [
    respiratoryDeterioration, positiveBloodCultures,
    inpatientHypoglycemia, citrateTubeVolume,
    inpatientFall, glucoseQualityControl,
  ],
}

export const practiceCasePacks: readonly {
  id: string
  definitions: readonly PracticeCaseDefinition[]
}[] = [
  { id: extendedDemoPack, definitions: extendedDemoCaseDefinitions },
  largePracticeCasePack,
]

export const practiceCaseDefinitions = practiceCasePacks.flatMap(pack => pack.definitions)
