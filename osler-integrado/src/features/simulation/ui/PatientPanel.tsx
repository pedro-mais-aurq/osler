import { useState } from 'react'
import type { ClinicalPresentationState, SimulationPatient } from '../types'
import {
  resolveNeutralPatientVisualRef,
  resolvePatientVisualRef,
} from './patientVisuals'

function PatientFacts({ patient }: { patient: SimulationPatient }) {
  const hasDetails =
    patient.ageYears !== null ||
    Boolean(patient.sexOrAnatomyContext) ||
    Boolean(patient.pronouns)

  if (!hasDetails) {
    return <p className="patient-facts-empty">Dados cadastrais não informados.</p>
  }

  return (
    <dl className="patient-facts">
      {patient.ageYears !== null ? (
        <div>
          <dt>Idade</dt>
          <dd>{patient.ageYears} anos</dd>
        </div>
      ) : null}
      {patient.sexOrAnatomyContext ? (
        <div>
          <dt>Contexto</dt>
          <dd>{patient.sexOrAnatomyContext}</dd>
        </div>
      ) : null}
      {patient.pronouns ? (
        <div>
          <dt>Pronomes</dt>
          <dd>{patient.pronouns}</dd>
        </div>
      ) : null}
    </dl>
  )
}

export interface PatientPanelProps {
  patient: SimulationPatient
  presentationState: ClinicalPresentationState
}

export function PatientPanel({ patient, presentationState }: PatientPanelProps) {
  const fallbackSource = resolveNeutralPatientVisualRef()
  const [imageSource, setImageSource] = useState(() =>
    resolvePatientVisualRef(patient.visualRef, patient.pronouns),
  )

  return (
    <aside
      aria-label="Paciente do caso"
      className={`patient-panel patient-state-${presentationState}`}
      data-presentation-state={presentationState}
    >
      <div aria-hidden="true" className="patient-panel-label">
        Paciente
      </div>
      <div className="patient-portrait-frame">
        <div aria-hidden="true" className="patient-room-line" />
        <img
          alt=""
          className="patient-portrait"
          data-testid="patient-visual"
          onError={() => {
            if (imageSource !== fallbackSource) {
              setImageSource(fallbackSource)
            }
          }}
          src={imageSource}
        />
      </div>
      <div className="patient-identity">
        <p className="patient-kicker">Pessoa vinculada ao caso</p>
        <h2>{patient.displayName}</h2>
        <PatientFacts patient={patient} />
      </div>
    </aside>
  )
}

export { PatientFacts }
export { resolvePatientVisualRef } from './patientVisuals'
