import { Link } from 'react-router-dom'
import { publicImage } from '../lib/publicImages'
import { Icon } from '../components/Icon'
import { useNeresMotion } from '../features/landing/useNeresMotion'

const method = [
  { title: 'Conhecer o cenário', text: 'Antes de começar, o caso apresenta seu contexto, as informações disponíveis e o objetivo educacional.' },
  { title: 'Ler as informações', text: 'O percurso avança por etapas. Novas informações ajudam a compreender a situação apresentada.' },
  { title: 'Fazer uma escolha', text: 'Nas etapas de decisão, o estudante escolhe uma ação e recebe o feedback definido para aquele cenário.' },
  { title: 'Revisitar a trajetória', text: 'Ao concluir, o debriefing reúne as decisões, o feedback, as consequências e as referências disponíveis.' },
]

export function ProjectPage() {
  const motionRoot = useNeresMotion()
  return (
    <div className="landing-page neres-osler n-detail-page" ref={motionRoot}>
      <header className="n-page-hero n-photographic-hero n-project-hero">
        <div className="n-page-hero-photo">
          <img src={publicImage('osler-projeto-hero.webp')} alt="Integrantes da Osler trabalhando juntos no desenvolvimento da plataforma de simulação clínica" width="1916" height="821" fetchPriority="high" />
          <Link className="n-back-link" to="/"><Icon name="back" width="17" height="17" /> Página inicial</Link>
        </div>
        <div className="n-page-hero-caption n-section">
          <div><p className="n-eyebrow">O PROJETO OSLER / UMA INICIATIVA DE EDUCAÇÃO</p><h1>Conhecimento que encontra<br />{' '}<em>espaço para virar prática.</em></h1></div>
          <div><p className="n-page-intro">Uma plataforma de simulação clínica interprofissional para conectar contexto, escolhas e reflexão na formação em saúde.</p><div className="n-page-meta"><span>EDUCAÇÃO EM SAÚDE</span><span>SIMULAÇÃO CLÍNICA</span><span>APRENDIZAGEM COM CONTEXTO</span></div></div>
        </div>
      </header>

      <section className="n-project-story n-section" id="proposta" aria-labelledby="proposal-title">
        <div><p className="n-eyebrow">01 / A PROPOSTA</p><h2 id="proposal-title">Entre estudar<br />e experimentar,<br /><em>um espaço para aprender.</em></h2></div>
        <div className="n-editorial-copy"><p className="n-editorial-lead">Aprender a cuidar envolve mais do que reconhecer uma informação. Envolve compreender o contexto em que ela aparece.</p><p>O Osler é uma iniciativa de educação voltada à simulação clínica interprofissional. A proposta é aproximar os conteúdos estudados das escolhas que surgem em um cenário de cuidado, com espaço para observar, decidir e refletir.</p><p>Em vez de apresentar somente uma resposta, a experiência convida o estudante a percorrer uma situação. O contexto, as informações do caso e as consequências ajudam a dar sentido a cada etapa.</p><p>Os cenários são fictícios e têm finalidade educacional. O foco da iniciativa é construir oportunidades de aprendizagem e reflexão sobre a trajetória de uma tentativa.</p></div>
      </section>

      <section className="n-method n-section" id="metodo" aria-labelledby="method-title">
        <div className="n-section-heading"><div><p className="n-eyebrow">02 / COMO O APRENDIZADO ACONTECE</p><h2 id="method-title">Um percurso.<br /><em>Mais de uma forma de aprender.</em></h2></div><p>Da primeira leitura ao debriefing, o estudante encontra momentos para compreender, agir e olhar novamente para o que fez.</p></div>
        <ol className="n-method-steps">{method.map((item, index) => <li key={item.title}><span>0{index + 1}</span><h3>{item.title}</h3><p>{item.text}</p></li>)}</ol>
        <Link className="n-text-link n-link-light" to="/demonstracao">Percorra uma demonstração guiada <Icon name="arrow" /></Link>
      </section>

      <section className="n-project-courses n-section" id="areas" aria-labelledby="project-courses-title">
        <div className="n-section-heading"><div><p className="n-eyebrow">03 / DIFERENTES SABERES</p><h2 id="project-courses-title">O cuidado e a análise.<br /><em>Perspectivas que se encontram.</em></h2></div><p>A plataforma contempla Enfermagem e Análises Clínicas, com cenários organizados de acordo com a formação do estudante.</p></div>
        <div className="n-project-course-grid">
          <article><Icon name="heart" width="34" height="34" /><h3>Enfermagem</h3><p>Um olhar para a pessoa, para as informações do cenário e para as decisões apresentadas ao longo do caso. Observação, acolhimento e contexto fazem parte dessa perspectiva de aprendizagem.</p><span>OBSERVAR A PESSOA. COMPREENDER O CONTEXTO.</span></article>
          <article><Icon name="flask" width="34" height="34" /><h3>Análises Clínicas</h3><p>Um olhar para as etapas do ambiente laboratorial e para os dados apresentados em cada cenário. A experiência conecta informações do caso à análise e à comunicação de resultados.</p><span>LER AS INFORMAÇÕES. CONECTAR OS SABERES.</span></article>
        </div>
        <p className="n-project-availability">Os casos disponíveis dependem da formação escolhida e da publicação de conteúdo revisado na plataforma.</p>
      </section>

      <section className="n-project-reflection n-section" id="reflexao" aria-labelledby="reflection-title">
        <img className="n-reflection-background" src={publicImage('osler-reflexao.webp')} alt="" aria-hidden="true" width="1672" height="941" loading="lazy" />
        <div className="n-reflection-mark" aria-hidden="true"><Icon name="book" width="94" height="94" /><span>OBSERVAR<br />DECIDIR<br />REFLETIR</span></div>
        <div className="n-editorial-copy"><p className="n-eyebrow">04 / A EXPERIÊNCIA NÃO TERMINA NA ESCOLHA</p><h2 id="reflection-title">O valor de<br /><em>olhar novamente.</em></h2><p className="n-editorial-lead">O feedback acompanha o cenário. O debriefing ajuda a enxergar o percurso.</p><p>Ao revisitar uma tentativa concluída, o estudante encontra suas escolhas e o retorno recebido em cada etapa. A reflexão parte daquela experiência, com suas informações e consequências.</p><p>Essa trajetória abre perguntas para o estudo e para a conversa: o que chamou atenção, por que uma alternativa foi escolhida e quais pontos merecem ser retomados? A intenção é transformar a experiência em material para continuar aprendendo.</p><p>As classificações apresentadas descrevem a tentativa. Elas não representam, por si só, uma avaliação geral de competência profissional.</p></div>
      </section>

      <section className="n-project-first-step n-section" id="primeiro-passo" aria-labelledby="first-step-title">
        <div><p className="n-eyebrow">05 / SEU PRIMEIRO CONTATO</p><h2 id="first-step-title">Comece conhecendo.<br /><em>Continue experimentando.</em></h2></div>
        <div className="n-editorial-copy"><p>A demonstração guiada permite conhecer os painéis, experimentar uma escolha de acolhimento e visualizar um feedback ilustrativo, sem criar uma conta ou salvar resultados.</p><p>Para participar dos casos da plataforma, o estudante entra como aluno, escolhe sua formação e acessa o conteúdo disponível para ela. Cada cenário apresenta seu objetivo antes do início.</p><div className="n-actions"><Link className="button" to="/demonstracao">Explorar a demonstração <Icon name="arrow" /></Link><Link className="n-text-link" to="/entrar">Acessar como aluno <Icon name="arrow" /></Link></div></div>
      </section>

      <section className="n-detail-callout n-section" aria-labelledby="project-team-title"><div><p className="n-eyebrow">AS PESSOAS POR TRÁS DA INICIATIVA</p><h2 id="project-team-title">Um projeto também<br /><em>é feito de encontros.</em></h2></div><div><p>Conheça as cinco frentes fundadoras e as perspectivas que se conectam na construção da proposta do Osler.</p><Link className="button" to="/fundadores">Conhecer os fundadores <Icon name="arrow" /></Link></div></section>
    </div>
  )
}
