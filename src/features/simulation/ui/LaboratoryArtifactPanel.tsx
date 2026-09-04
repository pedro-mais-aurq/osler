import { useId } from 'react'
import type {
  LaboratoryStage,
  LaboratoryVisibleData,
} from '../types'

const stageLabels: Record<LaboratoryStage, string> = {
  request: 'Solicitação',
  sample: 'Amostra',
  preanalytical: 'Verificação pré-analítica',
  analysis: 'Análise',
  result: 'Resultado técnico',
}

export function getLaboratoryTabLabel(stage: LaboratoryStage) {
  return stage === 'sample' || stage === 'preanalytical'
    ? 'Amostra'
    : stageLabels[stage]
}

export interface LaboratoryArtifactPanelProps {
  data: LaboratoryVisibleData
}

export function LaboratoryArtifactPanel({ data }: LaboratoryArtifactPanelProps) {
  const titleId = useId()
  const showsSample = data.stage === 'sample' || data.stage === 'preanalytical'

  return (
    <section
      aria-labelledby={titleId}
      className={`laboratory-artifact laboratory-stage-${data.stage}`}
      data-laboratory-stage={data.stage}
    >
      <header className="laboratory-artifact-header">
        <div aria-hidden="true" className="laboratory-artifact-symbol">
          {showsSample ? (
            <span className="sample-tube">
              <span className="sample-tube-cap" />
              <span className="sample-tube-body" />
            </span>
          ) : (
            <span className="laboratory-document-symbol" />
          )}
        </div>
        <div>
          <p className="sheet-label">{stageLabels[data.stage]}</p>
          <h2 id={titleId}>{data.title}</h2>
        </div>
      </header>

      <dl className="laboratory-fields">
        {data.fields.map((field) => (
          <div key={`${field.label}-${field.value}`}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>

      {data.notes && data.notes.length > 0 ? (
        <div className="laboratory-notes">
          <p className="sheet-label">Notas visíveis</p>
          <ul>
            {data.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
