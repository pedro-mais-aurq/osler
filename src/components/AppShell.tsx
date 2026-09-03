import type { PropsWithChildren } from 'react'
import { NavLink } from 'react-router-dom'
import Logo from '../assets/osler_logo.svg'

const developmentRoutes = [
  { to: '/', label: 'Entrada', end: true },
  { to: '/curso', label: 'Curso' },
  { to: '/simulacao', label: 'Simulação' },
]

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink className="brand" to="/" aria-label="OSLER — ir para a entrada">
          <img src = {Logo} style={{ width: '150px', height: 'auto' }}></img>
        </NavLink>

        <nav className="development-nav" aria-label="Navegação principal">
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
        MVP · Parte 3/10
      </footer>
    </div>
  )
}
