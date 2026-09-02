import { Link } from 'react-router-dom'

export function CourseSelectionPage() {
  return (
    <section className="page-card" aria-labelledby="course-title">
      <p className="eyebrow">Rota /curso</p>
      <h1 id="course-title">Seleção de curso</h1>
      <p>
        A seleção funcional entre Enfermagem e Análises Clínicas será implementada na
        Parte 3. Por enquanto, esta tela valida o fluxo de navegação.
      </p>
      <div className="action-row">
        <Link className="secondary-action" to="/">
          Voltar
        </Link>
        <Link className="primary-action" to="/simulacao">
          Continuar no fluxo provisório
        </Link>
      </div>
    </section>
  )
}
