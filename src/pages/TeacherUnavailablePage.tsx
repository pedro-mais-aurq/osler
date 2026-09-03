import { Link } from 'react-router-dom'

export function TeacherUnavailablePage() {
  return (
    <section className="page-card" aria-labelledby="teacher-title">
      <p className="eyebrow">Professor</p>
      <h1 id="teacher-title">Área do professor em desenvolvimento</h1>
      <p>
        O acesso de professores fará parte de uma etapa futura. Nenhuma conta ou sessão é
        criada nesta página.
      </p>
      <div className="action-row">
        <Link className="secondary-action" to="/">
          Voltar
        </Link>
      </div>
    </section>
  )
}
