import type { ClinicalPresentationState } from '../types'

const stateLabels: Record<ClinicalPresentationState, string> = {
  stable: 'Estável',
  warning: 'Atenção',
  critical: 'Crítico',
  recovery: 'Recuperação',
}

export interface PresentationStateBadgeProps {
  state: ClinicalPresentationState
}

export function PresentationStateBadge({
  state,
}: PresentationStateBadgeProps) {
  return (
    <span
      className={`presentation-state-badge state-${state}`}
      data-presentation-state={state}
      role="status"
    >
      <span aria-hidden="true" className="state-marker" />
      Estado: {stateLabels[state]}
    </span>
  )
}
