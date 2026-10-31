import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'

export function FormationExplorer() {
  const [formation, setFormation] = useState<'nursing' | 'laboratory'>('nursing')
  const nursing = formation === 'nursing'
  return (
    <section className="n-formation n-section" id="formacoes" aria-labelledby="formations-title">
      <div className="n-section-heading">
        <div>
          <p className="n-eyebrow">04 / DIFERENTES SABERES, O MESMO CUIDADO</p>
          <h2 id="formations-title">Um espaço para<br /><em>a sua formação.</em></h2>
        </div>
        <div className="formation-switch" role="group" aria-label="Explorar formações">
          <button type="button" aria-pressed={nursing} onClick={() => setFormation('nursing')}>
            <Icon name="heart" width="17" height="17" /> Enfermagem
          </button>
          <button type="button" aria-pressed={!nursing} onClick={() => setFormation('laboratory')}>
            <Icon name="flask" width="17" height="17" /> Análises Clínicas
          </button>
        </div>
      </div>
      <div className="formation-content" key={formation}>
        <div className="formation-copy">
          <span className="formation-icon"><Icon name={nursing ? 'heart' : 'flask'} width="29" height="29" /></span>
          <p className="tiny-label">{nursing ? 'ENFERMAGEM' : 'ANÁLISES CLÍNICAS'}</p>
          <h3>{nursing ? <>O olhar atento<br />faz a diferença.</> : <>Por trás de um resultado,<br />existem boas decisões.</>}</h3>
          <p>{nursing ? 'Exercite a observação, o acolhimento e a tomada de decisão em cenários que colocam a pessoa no centro.' : 'Explore as etapas do ambiente laboratorial, conectando informações do caso à análise e à comunicação de resultados.'}</p>
          <ul className="formation-list">
            <li><Icon name="check" />{nursing ? 'Contexto e informações do paciente' : 'Solicitação e informações da amostra'}</li>
            <li><Icon name="check" />{nursing ? 'Escolhas e consequências no cenário' : 'Etapas e dados apresentados progressivamente'}</li>
            <li><Icon name="check" />Feedback e reflexão sobre sua trajetória</li>
          </ul>
          <Link to={`/entrar?curso=${nursing ? 'nursing' : 'clinical_analysis'}`} className="n-text-link">Explorar minha formação <Icon name="arrow" /></Link>
        </div>
        <div className="product-preview" aria-label={`Prévia ilustrativa de ${nursing ? 'Enfermagem' : 'Análises Clínicas'}`}>
          <div className="preview-topbar">
            <span className="preview-logo">osler.</span>
            <span><span className="status-dot" /> PRÉVIA ILUSTRATIVA</span>
            <span className="preview-dots">•••</span>
          </div>
          <div className="preview-body">
            <div className="preview-sidebar">
              <span className="preview-avatar"><Icon name={nursing ? 'user' : 'flask'} width="44" height="44" /></span>
              <strong>{nursing ? 'Helena Costa' : 'Ambiente laboratorial'}</strong>
              <span>{nursing ? 'Paciente fictícia · 48 anos' : 'Dados fictícios'}</span>
              <div className="preview-patient-tag">{nursing ? 'Acolhimento' : 'Análise do contexto'}</div>
              <div className="preview-sidebar-row"><Icon name="clipboard" width="15" height="15" /> Informações do caso</div>
              <div className="preview-sidebar-row muted"><Icon name="book" width="15" height="15" /> Objetivo educacional</div>
            </div>
            <div className="preview-sheet">
              <p className="tiny-label">{nursing ? 'ETAPA 01 · PRIMEIRO CONTATO' : 'ETAPA 01 · CONTEXTO DO CASO'}</p>
              <h4>{nursing ? 'Toda pessoa tem uma história.' : 'Cada detalhe conta.'}</h4>
              <p>{nursing ? 'Helena chegou para seu primeiro atendimento. Antes de continuar, conheça o contexto e acolha suas dúvidas.' : 'Conheça a solicitação, observe os dados disponíveis e compreenda o objetivo desta etapa do cenário.'}</p>
              <div className="preview-sheet-tabs"><span>Prancheta</span><span>{nursing ? 'Paciente' : 'Solicitação'}</span></div>
              <p className="preview-prompt">{nursing ? 'Como você iniciaria essa conversa?' : 'Por onde você começaria sua análise?'}</p>
              <div className="preview-option"><span className="preview-radio" />{nursing ? 'Apresentar-se e ouvir a paciente' : 'Conhecer as informações do caso'}</div>
              <div className="preview-option"><span className="preview-radio" />{nursing ? 'Seguir diretamente para a próxima etapa' : 'Avançar sem revisar o contexto'}</div>
              <Link to="/demonstracao" className="preview-button">Experimentar a interface <Icon name="arrow" width="15" height="15" /></Link>
            </div>
          </div>
          <div className="preview-footer"><Icon name="shield" width="13" height="13" /> Cenário ilustrativo · Sem dados reais</div>
        </div>
      </div>
    </section>
  )
}
