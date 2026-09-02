import type { PropsWithChildren } from 'react'
import { NavLink } from 'react-router-dom'

const developmentRoutes = [
  { to: '/', label: 'Entrada', end: true },
  { to: '/curso', label: 'Curso' },
  { to: '/simulacao', label: 'Simulação' },
  { to: '/resultado', label: 'Resultado' },
]

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink className="brand" to="/" aria-label="OSLER — ir para a entrada">
          OSLER
        </NavLink>

        <nav className="development-nav" aria-label="Navegação provisória">
          {developmentRoutes.map(({ to, label, end }) => (
            <NavLink
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              end={end}
              key={to}
              to={to}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="app-main">{children}</main>

      <footer className="app-footer">
        Fundação técnica do MVP · Parte 1/10
      </footer>
    </div>
  )
}
