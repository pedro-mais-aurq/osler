import { publicImage } from '../lib/publicImages'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { founders } from '../features/landing/founders'
import { founderDetails } from '../features/landing/founderDetails'
import { useNeresMotion } from '../features/landing/useNeresMotion'

export function FoundersPage() {
  const motionRoot = useNeresMotion()
  return (
    <div className="landing-page neres-osler n-detail-page" ref={motionRoot}>
      <header className="n-page-hero n-photographic-hero n-founders-hero">
        <div className="n-page-hero-photo">
          <img src={publicImage('osler-fundadores-hero.webp')} alt="Os cinco integrantes da equipe fundadora da Osler reunidos em uma mesa de trabalho" width="1448" height="1086" fetchPriority="high" />
          <Link className="n-back-link" to="/"><Icon name="back" width="17" height="17" /> Página inicial</Link>
        </div>
        <div className="n-page-hero-caption n-section">
          <div><p className="n-eyebrow">OS FUNDADORES / PESSOAS, PERSPECTIVAS E PROPÓSITO</p><h1>Quem dá vida<br /><em>à iniciativa.</em></h1></div>
          <div><p className="n-page-intro">O Osler reúne cinco frentes em torno de uma ideia: criar espaço para o conhecimento se transformar em experiência de aprendizagem.</p><div className="n-page-meta"><span>CINCO OLHARES COMPLEMENTARES</span><span>UM PROJETO EM COMUM</span></div></div>
        </div>
      </header>

      <nav className="n-team-index" aria-label="Ir para uma frente fundadora">
        {founders.map((founder, index) => <Link to={`/fundadores#${founder.id}`} key={founder.id}><span>0{index + 1}</span><strong>{founder.title}</strong><Icon name="diagonal" width="15" height="15" /></Link>)}
      </nav>

      {founders.map((founder, index) => {
        const detail = founderDetails[founder.id]
        const next = founders[index + 1]
        return (
          <section className={`n-profile n-section${index % 2 ? ' n-profile-reverse' : ''}`} id={founder.id} aria-labelledby={`profile-${founder.id}`} key={founder.id}>
            <div className="n-profile-art" data-scroll-scene="pan" data-scroll-direction={index % 2 ? '-1' : '1'}>
              <span className="n-profile-halo" aria-hidden="true" />
              <span className="n-profile-number" aria-hidden="true">0{index + 1}</span>
              <div className="n-profile-layer" data-motion-layer><img src={publicImage(`founders/${founder.file}`)} alt={`Retrato do fundador apresentado como ${founder.title.toLowerCase()}`} width={founder.width} height={founder.height} loading="lazy" /></div>
              <span className="n-profile-art-label">EQUIPE FUNDADORA / OSLER</span>
            </div>
            <div className="n-profile-copy">
              <p className="n-eyebrow">0{index + 1} / {founder.area}</p>
              <h2 id={`profile-${founder.id}`}>{founder.title}</h2>
              <p className="n-profile-lead">{detail.headline}</p>
              {detail.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
              <div className="n-profile-focus"><h3>No centro desta frente</h3><ul>{detail.focus.map(item => <li key={item}><Icon name="check" width="14" height="14" /><span>{item}</span></li>)}</ul></div>
              {next ? <Link className="n-text-link" to={`/fundadores#${next.id}`}>Próxima frente <Icon name="arrow" /></Link> : <Link className="n-text-link" to="/projeto">Conheça o projeto Osler <Icon name="arrow" /></Link>}
            </div>
          </section>
        )
      })}

      <section className="n-detail-callout n-section" aria-labelledby="team-purpose-title">
        <div><p className="n-eyebrow">DIFERENTES FRENTES, A MESMA DIREÇÃO</p><h2 id="team-purpose-title">Uma equipe em torno<br /><em>do aprender.</em></h2></div>
        <div><p>Os cargos apresentados organizam as perspectivas que compõem a iniciativa. A conexão entre elas é o que dá unidade à proposta educacional do Osler.</p><div className="n-actions"><Link className="button" to="/projeto">Entender o projeto <Icon name="arrow" /></Link><Link className="n-text-link" to="/demonstracao">Conhecer a experiência <Icon name="arrow" /></Link></div></div>
      </section>
    </div>
  )
}
