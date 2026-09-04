import type { CaseStep, StepEvaluation } from './types'

export interface StepRendererProps {
  step: CaseStep
  selectedOptionId: string | null
  disabled?: boolean
  evaluation: StepEvaluation | null
  onSelectOption: (optionId: string) => void
}

const classificationLabels: Record<StepEvaluation['classification'], string> = {
  ideal: 'Escolha ideal',
  acceptable: 'Escolha aceitável',
  needs_improvement: 'Pode melhorar',
  unsafe: 'Escolha insegura',
}

function StepBody({ step }: { step: CaseStep }) {
  return (
    <>
      <h1 id="step-title">{step.title ?? 'Continuação do caso'}</h1>
      <p>{step.content.body}</p>

      {step.content.observations.length > 0 ? (
        <ul className="observation-list">
          {step.content.observations.map((observation) => (
            <li key={observation}>{observation}</li>
          ))}
        </ul>
      ) : null}
    </>
  )
}

function EvaluationFeedback({ evaluation }: { evaluation: StepEvaluation }) {
  return (
    <div className={`evaluation-feedback ${evaluation.classification}`} role="status">
      <p className="status-label">
        {classificationLabels[evaluation.classification]}
      </p>
      <p>{evaluation.feedback}</p>
      {evaluation.consequence ? <p>{evaluation.consequence}</p> : null}
    </div>
  )
}

export function StepRenderer({
  step,
  selectedOptionId,
  disabled = false,
  evaluation,
  onSelectOption,
}: StepRendererProps) {
  switch (step.type) {
    case 'information':
      return <StepBody step={step} />
    case 'decision':
      return (
        <>
          <StepBody step={step} />
          <div
            aria-busy={disabled}
            aria-label="Opções de decisão"
            className="decision-options"
          >
            {step.options.map((option) => (
              <button
                className={`decision-option${
                  selectedOptionId === option.id ? ' selected' : ''
                }`}
                disabled={disabled || evaluation !== null}
                key={option.id}
                onClick={() => onSelectOption(option.id)}
                type="button"
              >
                <span>{option.label}</span>
                {selectedOptionId === option.id ? (
                  <strong className="decision-selection-label">
                    Opção escolhida
                  </strong>
                ) : null}
              </button>
            ))}
          </div>

          {evaluation ? <EvaluationFeedback evaluation={evaluation} /> : null}
        </>
      )
    default: {
      const unsupportedStep: never = step

      if (import.meta.env.DEV) {
        console.error('Tipo de etapa não suportado pelo StepRenderer.', unsupportedStep)
      }

      return (
        <div className="status-message status-error" role="alert">
          <p>Este tipo de etapa ainda não é suportado.</p>
        </div>
      )
    }
  }
}
