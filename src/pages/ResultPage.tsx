import { Link } from 'react-router-dom'

export function ResultPage() {
  return (
    <section className="page-card" aria-labelledby="result-title">
      <p className="eyebrow">Rota /resultado</p>
      <h1 id="result-title">Resultado</h1>
      <p>
        A rota final está disponível apenas para comprovar a navegação. O debriefing
        pedagógico pertence a uma parte posterior do MVP.
      </p>
      <Link className="primary-action" to="/">
        Retornar à entrada
      </Link>
    </section>
  )
}
