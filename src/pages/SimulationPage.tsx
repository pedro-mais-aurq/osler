import { Link } from 'react-router-dom'

export function SimulationPage() {
  return (
    <section className="page-card" aria-labelledby="simulation-title">
      <p className="eyebrow">Rota /simulacao</p>
      <h1 id="simulation-title">Simulação</h1>
      <p>
        Espaço reservado para o fluxo futuro. Nenhum paciente, decisão, pontuação ou
        estado clínico foi criado nesta fundação.
      </p>
      <div className="action-row">
        <Link className="secondary-action" to="/curso">
          Voltar
        </Link>
        <Link className="primary-action" to="/resultado">
          Validar próxima rota
        </Link>
      </div>
    </section>
  )
}
