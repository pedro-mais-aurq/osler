import { Link, useLocation } from 'react-router-dom'
import type { MinimalSimulationResult } from '../types/database'

function isSimulationResult(value: unknown): value is MinimalSimulationResult {
  if (!value || typeof value !== 'object') {
    return false
  }

  const result = value as Record<string, unknown>

  return (
    typeof result.caseId === 'string' &&
    typeof result.caseTitle === 'string' &&
    typeof result.score === 'number' &&
    Number.isInteger(result.score) &&
    typeof result.decisionCount === 'number' &&
    Number.isInteger(result.decisionCount)
  )
}

export function ResultPage() {
  const location = useLocation()
  const result = isSimulationResult(location.state) ? location.state : null

  if (!result) {
    return (
      <section className="page-card" aria-labelledby="result-title">
        <p className="eyebrow">Resultado</p>
        <h1 id="result-title">Nenhum resultado de simulação disponível</h1>
        <p>Conclua uma simulação para visualizar o resumo desta tentativa.</p>
        <Link className="primary-action" to="/simulacao">
          Voltar à simulação
        </Link>
      </section>
    )
  }

  return (
    <section className="page-card result-summary" aria-labelledby="result-title">
      <p className="eyebrow">Caso concluído</p>
      <h1 id="result-title">Resultado</h1>
      <h2>{result.caseTitle}</h2>
      <dl className="result-details">
        <div>
          <dt>Pontuação</dt>
          <dd>{result.score}</dd>
        </div>
        <div>
          <dt>Decisões avaliadas</dt>
          <dd>{result.decisionCount}</dd>
        </div>
      </dl>
      <p className="scope-note">
        Este é um resumo mínimo. O debriefing pedagógico detalhado pertence a uma etapa posterior do MVP.
      </p>
      <div className="action-row">
        <Link className="primary-action" to="/simulacao">
          Fazer outro caso
        </Link>
        <Link className="secondary-action" to="/">
          Retornar à entrada
        </Link>
      </div>
    </section>
  )
}
