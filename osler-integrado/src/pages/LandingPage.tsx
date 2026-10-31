import { publicImage } from '../lib/publicImages'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { FormationExplorer } from '../features/landing/FormationExplorer'
import { useNeresMotion } from '../features/landing/useNeresMotion'
import OslerSymbol from '../assets/osler_logo_unica.svg'

const learningSteps = [
  { label: 'Observar', title: 'O aprendizado começa pelo olhar.', text: 'Conheça a pessoa, leia o contexto e perceba as informações que dão sentido ao cenário. Antes da primeira escolha, existe uma história para compreender.', word: 'CONTEXTO', sheet: 'Toda pessoa tem uma história.', detail: 'Conhecer antes de agir.', icon: 'user' as const },
  { label: 'Decidir', title: 'Uma escolha abre novos caminhos.', text: 'Conecte o que você sabe às informações apresentadas. Escolha uma ação e acompanhe as consequências dentro da simulação.', word: 'ESCOLHA', sheet: 'Qual será o seu próximo passo?', detail: 'Pensar. Escolher. Acompanhar.', icon: 'clipboard' as const },
  { label: 'Refletir', title: 'Revisitar também é aprender.', text: 'Olhe novamente para a sua trajetória. O feedback e o debriefing ajudam a compreender as escolhas e a construir novas perspectivas.', word: 'REFLEXÃO', sheet: 'O que essa experiência ensinou?', detail: 'A experiência continua na reflexão.', icon: 'book' as const },
]

const questions = [
  { title: 'O que é o projeto Osler?', answer: 'O Osler é uma iniciativa de educação voltada à simulação clínica interprofissional. A proposta é aproximar teoria e prática por meio de cenários, escolhas e reflexão sobre a experiência.' },
  { title: 'Quais formações estão contempladas?', answer: 'A plataforma contempla Enfermagem e Análises Clínicas. Os casos disponíveis dependem do curso escolhido e da publicação de conteúdo revisado na plataforma.' },
  { title: 'Como funciona o feedback?', answer: 'Durante um caso, suas decisões recebem o feedback definido para aquele cenário. Ao concluir, você pode consultar um debriefing com suas escolhas, consequências e referências disponíveis.' },
  { title: 'Posso conhecer antes de entrar?', answer: 'Sim. A demonstração guiada apresenta a interface com um cenário ilustrativo de acolhimento. Ela não cria uma conta e não salva resultados. Para participar dos casos da plataforma, acesse como aluno.' },
]

export function LandingPage() {
  const [learningStep, setLearningStep] = useState(0)
  const step = learningSteps[learningStep]
  const motionRoot = useNeresMotion()

  return (
    <div className="landing-page neres-osler" ref={motionRoot}>
      <section className="n-hero" id="inicio" aria-labelledby="hero-title">
        <div className="n-hero-copy">
          <p className="n-eyebrow">Os garotos da Osler</p>
          <h1 id="hero-title">O cuidado começa<br /><em>na educação.</em></h1>
          <p className="n-hero-intro">Entre a teoria e o primeiro atendimento,<br />existe um lugar para praticar, escolher e aprender.</p>
          <div className="n-actions">
            <Link className="button" to="/entrar">Começar a aprender <Icon name="arrow" /></Link>
            <Link className="n-text-link n-link-light" to="/demonstracao">Conhecer a experiência <Icon name="arrow" /></Link>
          </div>
        </div>
        <div className="n-hero-emblem" aria-hidden="true"><span className="n-emblem-ring" /><img src={OslerSymbol} alt="" width="290" height="330" /><span>CONHECIMENTO + HUMANIDADE</span></div>
        <Link className="n-hero-corner" to="/#sala-de-aula"><span className="n-seal"><Icon name="book" width="26" height="26" /></span><span>CONHECIMENTO.<br />PRÁTICA. HUMANIDADE.</span><span className="n-scroll-arrow" aria-hidden="true">↓</span></Link>
      </section>

      <section className="n-classroom" id="sala-de-aula" aria-labelledby="classroom-title">
        <div className="n-section n-classroom-intro"><div><p className="n-eyebrow">UM ESPAÇO PARA CONECTAR SABERES</p><h2 id="classroom-title">A educação encontra<br /><em>novas possibilidades.</em></h2></div><div><p>Uma representação do encontro entre o estudo, a simulação e a construção de um olhar atento para o cuidado.</p><Link className="n-text-link" to="/projeto">Conheça a proposta do Osler <Icon name="arrow" /></Link></div></div>
      </section>

      <section className="n-experience n-section" id="como-funciona" aria-labelledby="experience-title">
        <div className="n-experience-copy">
          <p className="n-eyebrow">01 / ANTES DA PRIMEIRA CONDUTA</p>
          <h2 id="experience-title">Aprender fazendo.<br /><em>E entendendo o porquê.</em></h2>
          <div className="n-step-description" aria-live="polite">
            <h3>{step.title}</h3><p>{step.text}</p>
          </div>
          <Link className="n-text-link n-link-light" to="/demonstracao">Explorar a demonstração <Icon name="arrow" /></Link>
          <div className="n-experience-options" role="group" aria-label="Explorar a jornada de aprendizagem">
            {learningSteps.map((item, index) => <button type="button" key={item.label} aria-pressed={learningStep === index} onClick={() => setLearningStep(index)}><small>0{index + 1}</small>{item.label}</button>)}
          </div>
        </div>
        <div className="n-learning-stage" data-scroll-scene="pan">
          <div className="n-stage-circle" aria-hidden="true" />
          <span className="n-stage-word" aria-hidden="true">{step.word}</span>
          <div className="n-learning-layer" data-motion-layer>
            <div className="n-learning-sheet" key={learningStep}>
              <div className="n-sheet-meta"><span>OSLER / EXPERIÊNCIA DE APRENDIZAGEM</span><span>0{learningStep + 1}</span></div>
              <span className="n-sheet-icon"><Icon name={step.icon} width="44" height="44" /></span>
              <h3>{step.sheet}</h3>
              {learningStep === 0 ? <div className="n-sheet-context"><span>PRIMEIRO CONTATO</span><p>Uma pessoa. Um contexto.<br />Um encontro para compreender.</p><div className="n-sheet-lines" aria-hidden="true"><i /><i /><i /></div></div>
                : learningStep === 1 ? <div className="n-sheet-choices"><p><span /> Conhecer o contexto</p><p><span /> Ouvir as dúvidas</p><small>Escolhas que dão forma à experiência.</small></div>
                : <div className="n-sheet-reflection"><Icon name="spark" width="23" height="23" /><p>O que você percebeu?<br />O que faria de outro jeito?</p><span>UM MOMENTO PARA REFLETIR</span></div>}
              <div className="n-sheet-bottom"><Icon name="shield" width="14" height="14" /><span>Prévia ilustrativa da jornada</span></div>
            </div>
          </div>
          <div className="n-stage-caption"><span>{step.label}.</span><small>{step.detail}</small></div>
        </div>
      </section>

      <section className="n-project n-section" id="projeto" aria-labelledby="project-title">
        <div className="n-project-intro">
          <p className="n-eyebrow">02 / O PROJETO OSLER</p>
          <h2 id="project-title">Educação em saúde.<br /><em>Um convite à prática.</em></h2>
          <div className="n-project-signature"><span /> Aprender hoje. Cuidar melhor amanhã.</div>
        </div>
        <div className="n-project-copy">
          <p className="n-project-lead">O Osler aproxima o conhecimento das escolhas que fazem parte do cuidado.</p>
          <p>Somos uma iniciativa de educação voltada à simulação clínica interprofissional. Nossa proposta é oferecer a estudantes um espaço para conhecer cenários, exercitar o raciocínio e refletir sobre suas decisões.</p>
          <Link className="n-text-link n-preview-link" to="/projeto">Conheça o projeto Osler <Icon name="arrow" /></Link>
        </div>
      </section>


      <figure className="n-photo-scene" data-scroll-scene="curtain">
        <img className="n-photo-image" data-motion-layer src={publicImage('osler-educacao.webp')} alt="Imagem ilustrativa de uma conversa acolhedora entre uma estudante de enfermagem e uma paciente" width="1122" height="1402" loading="lazy" />
        <div className="n-photo-shade" />
        <figcaption><p className="n-eyebrow">O CONHECIMENTO ENCONTRA A HUMANIDADE</p><p>Antes de cuidar,<br /><em>aprenda a escutar.</em></p><span>APRENDER · REFLETIR · CUIDAR</span></figcaption>
      </figure>

      <FormationExplorer />

      <section className="n-faq n-section" aria-labelledby="faq-title">
        <div><p className="n-eyebrow">05 / ANTES DE COMEÇAR</p><h2 id="faq-title">Boas perguntas.<br /><em>Caminhos mais claros.</em></h2><Link className="n-text-link" to="/demonstracao">Conheça a demonstração <Icon name="arrow" /></Link></div>
        <div className="n-faq-list">{questions.map((item, index) => <details key={item.title}><summary><span>0{index + 1}</span><strong>{item.title}</strong><Icon name="chevron" width="17" height="17" /></summary><p>{item.answer}</p></details>)}</div>
      </section>

      <section className="n-start n-section" id="comecar" aria-labelledby="start-title">
        <div><p className="n-eyebrow">06 / SUA PRÓXIMA EXPERIÊNCIA</p><h2 id="start-title">O próximo passo<br /><em>começa com uma escolha.</em></h2><p>Conheça a plataforma. Explore um cenário.<br />Dê espaço para uma nova forma de aprender.</p></div>
        <div className="n-start-actions"><Link className="button" to="/entrar">Acessar a plataforma <Icon name="arrow" /></Link><Link className="n-text-link" to="/demonstracao">Experimentar a demonstração <Icon name="arrow" /></Link><small>Simulação educacional com cenários fictícios.</small></div>
      </section>
    </div>
  )
}
