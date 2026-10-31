import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ClinicalSimulationView } from '../features/simulation/ui/ClinicalSimulationView'
import type { DecisionStep, SimulationCase, StepEvaluation } from '../features/simulation/types'
import '../features/simulation/simulation.css'

const demoStep: DecisionStep = {
  id: 'demo-decision', caseId: 'demo', position: 1, stepKey: 'first-contact', type: 'decision',
  title: 'Como você iniciaria essa conversa?',
  content: { body: 'Helena está em seu primeiro encontro com a equipe. Ela olha ao redor e comenta: “É a primeira vez que venho aqui. Não sei muito bem como vai funcionar.”', observations: ['Este exercício apresenta os controles da interface.', 'Escolha uma alternativa para conhecer o feedback ilustrativo.'] },
  presentationState: 'stable',
  options: [{ id: 'listen', label: 'Apresentar-se, perguntar como ela prefere ser chamada e ouvir suas dúvidas.' }, { id: 'continue', label: 'Pedir que aguarde e seguir para a próxima etapa sem conversar.' }],
}

const demoCase: SimulationCase = {
  case: { id: 'demo', slug: 'acolhimento-demonstracao', title: 'O primeiro encontro', description: 'Um cenário ilustrativo para explorar a interface do Osler. Conheça Helena e experimente uma escolha sobre acolhimento e comunicação.', educationalObjective: 'Conhecer os painéis de informação, a seleção de alternativas e a apresentação do feedback.', status: 'draft' },
  patient: { id: 'demo-helena', displayName: 'Helena Costa', ageYears: 48, pronouns: 'ela/dela', sexOrAnatomyContext: 'Pessoa fictícia da demonstração', visualRef: null },
  firstStep: demoStep,
}

export function DemoPage() {
  const [stage, setStage] = useState<'intro' | 'decision' | 'complete'>('intro')
  const [choice, setChoice] = useState<string | null>(null)
  const evaluation: StepEvaluation | null = choice ? {
    classification: choice === 'listen' ? 'acceptable' : 'needs_improvement', scoreDelta: 0,
    feedback: choice === 'listen' ? 'Ao abrir espaço para a conversa, você conhece as dúvidas da pessoa e torna o encontro mais acolhedor. Este é um exemplo de como o feedback aparece na plataforma.' : 'Que tal abrir espaço para conhecer Helena antes de seguir? Nesta demonstração, essa escolha serve para mostrar como um ponto de reflexão aparece no feedback.',
    consequence: null,
  } : null

  function reset() { setChoice(null); setStage('intro') }

  return <div className="demo-page content-width">
    <div className="demo-heading"><div><p className="eyebrow">UM PRIMEIRO CONTATO COM O OSLER</p><h1>Dê o primeiro passo.<br /><em>O cenário é seu.</em></h1></div><div className="demo-disclaimer"><Icon name="shield" /><span>Demonstração da interface<br /><strong>Sem cadastro e sem resultados salvos</strong></span></div></div>
    <ol className="demo-progress" aria-label="Etapas da demonstração">{['Conheça o cenário', 'Faça uma escolha', 'Reflita sobre a experiência'].map((label, index) => <li className={index <= ['intro', 'decision', 'complete'].indexOf(stage) ? 'is-active' : ''} aria-current={index === ['intro', 'decision', 'complete'].indexOf(stage) ? 'step' : undefined} key={label}><span>{index + 1}</span>{label}</li>)}</ol>
    {stage === 'complete' ? <section className="demo-complete" aria-labelledby="demo-complete-title"><span className="completion-icon"><Icon name="check" width="32" height="32" /></span><p className="eyebrow">EXPERIÊNCIA CONCLUÍDA</p><h2 id="demo-complete-title">Cada escolha é<br /><em>um começo.</em></h2><p>Você conheceu as informações do cenário, fez uma escolha e recebeu um feedback. Nos casos da plataforma, o debriefing reúne a trajetória completa da tentativa.</p><div className="demo-reflection"><Icon name="book" /><div><strong>Um momento para refletir</strong><p>Que diferença uma boa conversa faz no primeiro encontro com uma pessoa?</p></div></div><div className="action-row"><Link className="button" to="/entrar">Acessar a plataforma <Icon name="arrow" /></Link><button className="secondary-action" type="button" onClick={reset}>Rever demonstração</button></div><small>Conteúdo ilustrativo de navegação. Sem avaliação de competência clínica.</small></section> : <ClinicalSimulationView {...(stage === 'intro' ? { mode: 'intro' as const, onStart: () => setStage('decision') } : { mode: 'step' as const, step: demoStep, stepNumber: 1, selectedOptionId: choice, evaluation, status: null, showContinue: Boolean(choice), onSelectOption: setChoice, onContinue: () => setStage('complete'), onRestart: reset, restartLabel: 'Recomeçar demonstração' })} simulationCase={demoCase} presentationState="stable" busy={false} errorMessage={null} onRetry={reset} />}
    <p className="demo-bottom-note">Este cenário ilustra a navegação e não integra o catálogo de casos publicados. <Link to="/entrar">Ir para a plataforma <Icon name="diagonal" width="12" height="12" /></Link></p>
  </div>
}
