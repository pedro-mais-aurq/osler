import { Link } from 'react-router-dom'

export function EntryPage() {
  return (
    <section className="page-card" aria-labelledby="entry-title">
      <p className="eyebrow">Simulação clínica interprofissional</p>
      <h1 id="entry-title">Entrada</h1>
      <p>
        Fundação navegável do OSLER. Nesta etapa ainda não há identidade, conteúdo clínico
        ou lógica de simulação.
      </p>
      <Link className="primary-action" to="/curso">
        Acessar seleção de curso
      </Link>
    </section>
  )
}
