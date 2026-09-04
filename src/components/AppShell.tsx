import type { PropsWithChildren } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import Logo from '../assets/osler_logo.svg'

const developmentRoutes = [
  { to: '/', label: 'Entrada', end: true },
  { to: '/curso', label: 'Curso' },
  { to: '/simulacao', label: 'Simulação' },
]

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation()
  const isEntry = location.pathname === '/'
  const isSimulation = location.pathname === '/simulacao'

  return (
    <div className={`app-shell${isSimulation ? ' simulation-mode' : ''}`}>
      <header className={`app-header${isEntry ? ' entry-header' : ''}`}>
        <NavLink className="brand" to="/" aria-label="OSLER — ir para a entrada">
          <img alt="" className="brand-logo" src={Logo} />
        </NavLink>

        {!isEntry ? (
          <nav className="development-nav" aria-label="Navegação principal">
            {developmentRoutes.map(({ to, label, end }) => (
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'nav-link active' : 'nav-link'
                }
                end={end}
                key={to}
                to={to}
              >
                {label}
              </NavLink>
            ))}
          </nav>
        ) : null}
      </header>

      <main className="app-main">{children}</main>

      <footer className="app-footer">
        MVP · Parte 7/10
      </footer>
    </div>
  )
}
