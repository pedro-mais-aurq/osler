import type { CaseStep, ClinicalPresentationState, SimulationCase, StepEvaluation } from '../types'
import { StepRenderer } from '../StepRenderer'
import { ClinicalClipboard } from './ClinicalClipboard'
import { PatientPanel } from './PatientPanel'

interface ClinicalSimulationViewBaseProps {
  simulationCase: SimulationCase
  presentationState: ClinicalPresentationState
}

interface ClinicalSimulationIntroProps extends ClinicalSimulationViewBaseProps {
  mode: 'intro'
  onStart: () => void
}

interface ClinicalSimulationStepProps extends ClinicalSimulationViewBaseProps {
  mode: 'step'
  step: CaseStep
  stepNumber: number
  selectedOptionId: string | null
  evaluation: StepEvaluation | null
  busy: boolean
  status: 'evaluating' | 'advancing' | null
  errorMessage: string | null
  showContinue: boolean
  onSelectOption: (optionId: string) => void
  onContinue: () => void
  onRetry: () => void
}

export type ClinicalSimulationViewProps =
  | ClinicalSimulationIntroProps
  | ClinicalSimulationStepProps

export function ClinicalSimulationView(props: ClinicalSimulationViewProps) {
  const { case: clinicalCase, patient } = props.simulationCase
  const isIntro = props.mode === 'intro'

  return (
    <section
      className={`clinical-simulation-view presentation-${props.presentationState}`}
      data-presentation-state={props.presentationState}
    >
      <div aria-hidden="true" className="clinical-room-object clinical-room-object-left" />
      <div aria-hidden="true" className="clinical-room-object clinical-room-object-right" />

      <PatientPanel
        key={patient.id}
        patient={patient}
        presentationState={props.presentationState}
      />

      <ClinicalClipboard
        clinicalCase={clinicalCase}
        patient={patient}
        presentationState={props.presentationState}
        stepNumber={isIntro ? null : props.stepNumber}
      >
        {isIntro ? (
          <div className="case-start-sheet">
            <p className="sheet-label">Próxima ação</p>
            <h2>Conheça o cenário antes de começar</h2>
            <p>
              Quando estiver pronto, inicie o atendimento. As informações serão
              apresentadas progressivamente.
            </p>
            <div className="clinical-action-row">
              <button className="primary-action" onClick={props.onStart} type="button">
                Iniciar caso
              </button>
            </div>
          </div>
        ) : (
          <>
            <StepRenderer
              disabled={props.busy}
              evaluation={props.evaluation}
              onSelectOption={props.onSelectOption}
              selectedOptionId={props.selectedOptionId}
              step={props.step}
            />

            {props.status === 'evaluating' ? (
              <p className="clinical-status-message" role="status">
                Avaliando sua escolha…
              </p>
            ) : null}

            {props.status === 'advancing' ? (
              <p className="clinical-status-message" role="status">
                Carregando próxima etapa…
              </p>
            ) : null}

            {props.errorMessage ? (
              <div className="clinical-error-note" role="alert">
                <p>{props.errorMessage}</p>
                <button className="text-action" onClick={props.onRetry} type="button">
                  Tentar novamente
                </button>
              </div>
            ) : null}

            {props.showContinue ? (
              <div className="clinical-action-row">
                <button
                  className="primary-action"
                  disabled={props.busy}
                  onClick={props.onContinue}
                  type="button"
                >
                  Continuar
                </button>
              </div>
            ) : null}
          </>
        )}
      </ClinicalClipboard>
    </section>
  )
}
