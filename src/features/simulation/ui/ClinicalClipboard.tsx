import type { PropsWithChildren } from 'react'
import type {
  ClinicalPresentationState,
  SimulationCaseSummary,
  SimulationPatient,
} from '../types'
import { PatientFacts } from './PatientPanel'
import { PresentationStateBadge } from './PresentationStateBadge'
import { WorkspaceTabs } from './WorkspaceTabs'

export interface ClinicalClipboardProps extends PropsWithChildren {
  clinicalCase: SimulationCaseSummary
  patient: SimulationPatient
  presentationState: ClinicalPresentationState
  stepNumber: number | null
}

export function ClinicalClipboard({
  children,
  clinicalCase,
  patient,
  presentationState,
  stepNumber,
}: ClinicalClipboardProps) {
  return (
    <section
      aria-labelledby="clinical-case-title"
      className={`clinical-clipboard clipboard-state-${presentationState}`}
      data-presentation-state={presentationState}
    >
      <div aria-hidden="true" className="clipboard-clip">
        <span />
      </div>
      <div className="clipboard-paper">
        <header className="clipboard-header">
          <div className="clipboard-meta">
            <span>{stepNumber === null ? 'Admissão do caso' : `Etapa ${stepNumber}`}</span>
            <PresentationStateBadge state={presentationState} />
          </div>
          <p className="clipboard-kicker">Simulação clínica educacional</p>
          <h1 id="clinical-case-title">{clinicalCase.title}</h1>
        </header>

        <WorkspaceTabs
          label="Informações da área clínica"
          tabs={[
            {
              id: 'clipboard',
              label: 'Prancheta',
              content: (
                <div className="clipboard-context">
                  <p>{clinicalCase.description}</p>
                  {clinicalCase.educationalObjective ? (
                    <div className="learning-note">
                      <p className="sheet-label">Objetivo educacional</p>
                      <p>{clinicalCase.educationalObjective}</p>
                    </div>
                  ) : null}
                </div>
              ),
            },
            {
              id: 'patient',
              label: 'Paciente',
              content: (
                <div className="clipboard-patient-summary">
                  <p className="sheet-label">Dados disponíveis</p>
                  <h2>{patient.displayName}</h2>
                  <PatientFacts patient={patient} />
                </div>
              ),
            },
          ]}
        />

        <div className="clinical-action-sheet">{children}</div>
      </div>
    </section>
  )
}
