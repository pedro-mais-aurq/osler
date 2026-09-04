import { useState } from 'react'
import type { ClinicalPresentationState, SimulationPatient } from '../types'

const fallbackVisualRef = 'patients/patient-neutral.svg'

function isSafeRelativeAssetPath(value: string) {
  return (
    value.length > 0 &&
    !value.includes('..') &&
    !value.includes('\\') &&
    !/^[a-z][a-z\d+.-]*:/i.test(value)
  )
}

export function resolvePatientVisualRef(visualRef: string | null) {
  const candidate = visualRef?.trim().replace(/^\/+/, '') ?? ''
  const relativePath = isSafeRelativeAssetPath(candidate)
    ? candidate
    : fallbackVisualRef
  const baseUrl = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`

  return `${baseUrl}${relativePath}`
}

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
  const fallbackSource = resolvePatientVisualRef(null)
  const [imageSource, setImageSource] = useState(() =>
    resolvePatientVisualRef(patient.visualRef),
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
        <p className="patient-kicker">Pessoa em atendimento</p>
        <h2>{patient.displayName}</h2>
        <PatientFacts patient={patient} />
      </div>
    </aside>
  )
}

export { PatientFacts }
