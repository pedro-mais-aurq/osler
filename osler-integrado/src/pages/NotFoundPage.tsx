import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="page-card" aria-labelledby="not-found-title">
      <p className="eyebrow">Erro 404</p>
      <h1 id="not-found-title">Rota não encontrada</h1>
      <p>O endereço informado não corresponde a uma página disponível no OSLER.</p>
      <Link className="primary-action" to="/">
        Voltar para a entrada
      </Link>
    </section>
  )
}
