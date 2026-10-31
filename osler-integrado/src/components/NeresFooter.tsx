import { Link } from 'react-router-dom'
import Logo from '../assets/osler_logo.svg'
import { Icon } from './Icon'

export function NeresFooter() {
  return (
    <footer className="n-footer">
      <div className="n-footer-main">
        <Link className="n-footer-brand" to="/" aria-label="Osler — voltar ao início"><img src={Logo} alt="" width="154" height="70" /><span>SIMULAÇÃO CLÍNICA<br />INTERPROFISSIONAL</span></Link>
        <p>Conhecimento que aproxima.<br /><em>Educação que se torna cuidado.</em></p>
        <Link className="n-footer-cta" to="/entrar">Comece sua experiência <Icon name="arrow" /></Link>
      </div>
      <div className="n-footer-bottom">
        <span>© {new Date().getFullYear()} Osler · Uma iniciativa de educação</span>
        <nav aria-label="Explorar o Osler"><Link to="/projeto">O projeto</Link><Link to="/#como-funciona">Como funciona</Link><Link to="/fundadores">Fundadores</Link><Link to="/#formacoes">Formações</Link></nav>
        <span>APRENDER · REFLETIR · CUIDAR</span>
      </div>
    </footer>
  )
}
