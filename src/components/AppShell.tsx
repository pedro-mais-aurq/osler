import { useEffect, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import Logo from '../assets/osler_logo.svg'
import { Icon } from './Icon'
import { NeresFooter } from './NeresFooter'
import { usePortal } from '../features/teaching/usePortal'
import { isLocalMode } from '../lib/dataMode'

const pageNames: Record<string, string> = {
  '/entrar': 'Seu espaço de aprendizagem',
  '/curso': 'Sua formação',
  '/participacao': 'Seu caminho de aprendizagem',
  '/casos-publicos': 'Casos públicos',
  '/simulacao': 'Ambiente de simulação',
  '/resultado': 'Reflexão e aprendizagem',
  '/professor': 'Espaço do educador',
  '/aluno': 'Minhas atividades',
  '/auth/callback': 'Conectando sua conta',
  '/demonstracao': 'Conheça a experiência',
  '/projeto': 'O projeto Osler',
  '/fundadores': 'Os fundadores',
}

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation()
  const isLanding = location.pathname === '/'
  const isPublicPage = isLanding || location.pathname === '/projeto' || location.pathname === '/fundadores'
  const isSimulation = location.pathname === '/simulacao'
  const isResult = location.pathname === '/resultado'
  const isPortal = location.pathname === '/aluno' || location.pathname.startsWith('/professor')
  const { identity } = usePortal()
  const workspacePath = identity ? identity.role === 'student' ? '/aluno' : '/professor' : '/entrar'
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
    const titles: Record<string, string> = { '/': 'Aprender a cuidar', '/projeto': 'O projeto Osler', '/fundadores': 'Os fundadores', '/demonstracao': 'Demonstração guiada', '/entrar': 'Entrar', '/curso': 'Escolha seu curso', '/simulacao': 'Simulação', '/resultado': 'Debriefing', '/professor': 'Para educadores', '/aluno': 'Minhas atividades', '/auth/callback': 'Conectando sua conta' }
    document.title = `${titles[location.pathname] ?? pageNames[location.pathname] ?? (location.pathname.startsWith('/professor/') ? 'Espaço do educador' : 'Página não encontrada')} · Osler`
    if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView?.()
    } else {
      document.getElementById('page-top')?.scrollIntoView?.({ block: 'start' })
    }
  }, [location.pathname, location.hash])

  useEffect(() => {
    if (!menuOpen) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        document.getElementById('menu-toggle')?.focus()
      }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  return (
    <div id="page-top" className={`app-shell${isPublicPage ? ' landing-mode' : ''}${!isLanding && isPublicPage ? ' public-detail-mode' : ''}${isPortal ? ' portal-mode' : ''}${isSimulation ? ' simulation-mode' : ''}${isResult ? ' result-mode' : ''}`}>
      <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); document.getElementById('main-content')?.scrollIntoView?.() }}>Pular para o conteúdo</a>
      <header className="app-header">
        <div className="header-inner">
          <NavLink className="brand" to="/" aria-label="OSLER — página inicial">
            <img alt="" className="brand-logo" src={Logo} />
            <span className="brand-caption">APRENDER A CUIDAR</span>
          </NavLink>
          <nav className="desktop-nav" aria-label="Navegação principal">
            {isPublicPage ? <>
              <Link to="/#como-funciona" data-section="como-funciona">Como funciona</Link>
              <NavLink to="/projeto">O projeto</NavLink>
              <NavLink to="/fundadores">Fundadores</NavLink>
              <Link to="/#formacoes" data-section="formacoes">Para sua formação</Link>
            </> : <>
              <NavLink to="/" end>Início</NavLink>
              {identity && <NavLink to={workspacePath}>Meu espaço</NavLink>}
              <NavLink to="/curso">Minha formação</NavLink>
              <NavLink to="/casos-publicos">Casos públicos</NavLink>
            </>}
          </nav>
          <div className="header-actions">
            <Link className="educator-link" to="/professor">Sou professor</Link>
            <Link className="button button-small" to={workspacePath}>{identity ? 'Meu espaço' : 'Acessar plataforma'} <Icon name="diagonal" width="15" height="15" /></Link>
            <button id="menu-toggle" className="icon-button mobile-toggle" type="button" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>
              <Icon name={menuOpen ? 'close' : 'menu'} />
            </button>
          </div>
        </div>
        {menuOpen && <nav id="mobile-navigation" className="mobile-navigation" aria-label="Navegação móvel">
          <Link to="/#como-funciona">Como funciona <Icon name="arrow" /></Link>
          <Link to="/projeto">O projeto <Icon name="arrow" /></Link>
          <Link to="/fundadores">Fundadores <Icon name="arrow" /></Link>
          <Link to="/#formacoes">Para sua formação <Icon name="arrow" /></Link>
          <Link to="/demonstracao">Explorar demonstração <Icon name="arrow" /></Link>
          <Link to="/participacao">Turma ou prática individual <Icon name="arrow" /></Link>
          <Link to="/casos-publicos">Casos públicos <Icon name="arrow" /></Link>
          <Link to="/professor">Sou professor <Icon name="arrow" /></Link>
        </nav>}
      </header>

      {!isPublicPage && <div className="workspace-bar"><div className="workspace-bar-inner"><Link to="/"><Icon name="back" width="14" height="14" /> Página inicial</Link><span className="workspace-bar-divider" /><span>{pageNames[location.pathname] ?? (isPortal ? 'Espaço do educador' : 'Osler')}</span><span className="education-label"><span className="status-dot" /> {isLocalMode ? 'Demonstração local · dados fictícios' : 'Ambiente educacional'}</span></div></div>}

      <main className="app-main" id="main-content" tabIndex={-1}>{children}</main>

      {isPublicPage ? <NeresFooter /> : <footer className="app-footer"><span>Osler · Aprender a cuidar</span><span>Simulação educacional com cenários fictícios</span></footer>}
    </div>
  )
}
