import { Link } from 'react-router-dom'
import type { StepClassification } from '../../simulation/types'
import {
  debriefClassificationLabels,
  isWellConducted,
} from '../summary'
import type {
  DebriefDecision,
  DebriefReference,
  SimulationDebrief,
} from '../types'

interface DebriefViewProps {
  debrief: SimulationDebrief
}

function classificationClass(classification: StepClassification): string {
  return classification.replace('_', '-')
}

function formatScoreDelta(scoreDelta: number): string {
  return scoreDelta > 0 ? `+${scoreDelta}` : String(scoreDelta)
}

function formatVerifiedDate(value: string): string {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function DecisionOverview({
  decisions,
  emptyMessage,
}: {
  decisions: DebriefDecision[]
  emptyMessage: string
}) {
  if (decisions.length === 0) {
    return <p className="debrief-empty-note">{emptyMessage}</p>
  }

  return (
    <ul className="debrief-overview-list">
      {decisions.map((decision) => (
        <li key={decision.actionId}>
          <span>Etapa {decision.position}</span>
          <strong>{decision.selectedOptionLabel}</strong>
          <small>{debriefClassificationLabels[decision.classification]}</small>
        </li>
      ))}
    </ul>
  )
}

function DecisionCard({ decision }: { decision: DebriefDecision }) {
  return (
    <li className="debrief-decision-item">
      <article
        className={`debrief-decision-card classification-${classificationClass(
          decision.classification,
        )}`}
      >
        <div className="debrief-decision-heading">
          <div>
            <p className="debrief-step-label">Decisão · etapa {decision.position}</p>
            <h3>{decision.stepTitle ?? decision.stepKey}</h3>
          </div>
          <span className="debrief-score-delta">
            Variação na pontuação: {formatScoreDelta(decision.scoreDelta)}
          </span>
        </div>

        <dl className="debrief-decision-details">
          <div>
            <dt>Sua escolha</dt>
            <dd>{decision.selectedOptionLabel}</dd>
          </div>
          <div>
            <dt>Classificação</dt>
            <dd>
              <span className="debrief-classification-label">
                {debriefClassificationLabels[decision.classification]}
              </span>
            </dd>
          </div>
        </dl>

        <div className="debrief-feedback-copy">
          <h4>Feedback recebido</h4>
          <p>{decision.feedback}</p>
        </div>

        {decision.consequence ? (
          <div className="debrief-consequence-copy">
            <h4>Consequência no cenário</h4>
            <p>{decision.consequence}</p>
          </div>
        ) : null}
      </article>
    </li>
  )
}

function ReferenceItem({ reference }: { reference: DebriefReference }) {
  const title = reference.url ? (
    <a
      aria-label={`${reference.title} — abrir referência em nova aba`}
      href={reference.url}
      rel="noreferrer noopener"
      target="_blank"
    >
      {reference.title}
    </a>
  ) : (
    <span>{reference.title}</span>
  )

  return (
    <li>
      <strong>{title}</strong>
      <span>
        {reference.authority}
        {reference.year ? ` · ${reference.year}` : ''}
      </span>
      {reference.verifiedOn ? (
        <small>Fonte verificada em {formatVerifiedDate(reference.verifiedOn)}</small>
      ) : null}
    </li>
  )
}

export function DebriefView({ debrief }: DebriefViewProps) {
  const wellConducted = debrief.decisions.filter((decision) =>
    isWellConducted(decision.classification),
  )
  const toReview = debrief.decisions.filter(
    (decision) => !isWellConducted(decision.classification),
  )
  const { classifications } = debrief.summary

  return (
    <section className="debrief-page" aria-labelledby="debrief-title">
      <div className="debrief-sheet">
        <header className="debrief-header">
          <div>
            <p className="eyebrow">Caso concluído</p>
            <h1 id="debrief-title">Debriefing da tentativa</h1>
            <p className="debrief-case-title">{debrief.caseTitle}</p>
          </div>
          <span className="debrief-education-tag">Simulação educacional fictícia</span>
        </header>

        <section className="debrief-objective" aria-labelledby="objective-title">
          <h2 id="objective-title">Objetivo educacional</h2>
          <p>
            {debrief.educationalObjective ??
              'O objetivo educacional não foi informado para este caso.'}
          </p>
        </section>

        <section className="debrief-summary" aria-labelledby="summary-title">
          <div className="debrief-section-heading">
            <p className="debrief-section-number">01</p>
            <h2 id="summary-title">Resumo da tentativa</h2>
          </div>
          <p className="debrief-summary-note">
            As contagens descrevem somente as decisões avaliadas nesta tentativa;
            não representam uma nota escolar ou competência profissional geral.
          </p>
          <dl className="debrief-summary-grid">
            <div>
              <dt>Pontuação bruta</dt>
              <dd>{debrief.summary.scoreTotal}</dd>
            </div>
            <div>
              <dt>Decisões avaliadas</dt>
              <dd>{debrief.summary.decisionCount}</dd>
            </div>
            <div>
              <dt>Muito adequadas</dt>
              <dd>{classifications.ideal}</dd>
            </div>
            <div>
              <dt>Adequadas</dt>
              <dd>{classifications.acceptable}</dd>
            </div>
            <div>
              <dt>Pontos de melhoria</dt>
              <dd>{classifications.needsImprovement}</dd>
            </div>
            <div>
              <dt>Atenções de segurança</dt>
              <dd>{classifications.unsafe}</dd>
            </div>
          </dl>
        </section>

        <section className="debrief-categories" aria-labelledby="reflection-title">
          <div className="debrief-section-heading">
            <p className="debrief-section-number">02</p>
            <h2 id="reflection-title">Leitura pedagógica</h2>
          </div>
          <div className="debrief-category-grid">
            <article className="debrief-category good-decisions">
              <h3>Decisões bem conduzidas</h3>
              <DecisionOverview
                decisions={wellConducted}
                emptyMessage="Nenhuma decisão desta tentativa foi classificada como ideal ou adequada. Consulte a trajetória para revisar o feedback registrado."
              />
            </article>
            <article className="debrief-category review-decisions">
              <h3>Pontos para revisar</h3>
              <DecisionOverview
                decisions={toReview}
                emptyMessage="Nenhum ponto de atenção foi registrado nas decisões avaliadas desta tentativa."
              />
            </article>
          </div>
        </section>

        <section className="debrief-trajectory" aria-labelledby="trajectory-title">
          <div className="debrief-section-heading">
            <p className="debrief-section-number">03</p>
            <div>
              <h2 id="trajectory-title">Trajetória de decisões</h2>
              <p>
                Sequência das decisões efetivamente registradas durante esta
                tentativa.
              </p>
            </div>
          </div>

          {debrief.decisions.length > 0 ? (
            <ol className="debrief-decision-list">
              {debrief.decisions.map((decision) => (
                <DecisionCard decision={decision} key={decision.actionId} />
              ))}
            </ol>
          ) : (
            <p className="debrief-empty-note">
              Esta tentativa foi concluída sem decisões avaliadas.
            </p>
          )}
        </section>

        <section className="debrief-references" aria-labelledby="references-title">
          <div className="debrief-section-heading">
            <p className="debrief-section-number">04</p>
            <div>
              <h2 id="references-title">Referências do caso</h2>
              <p>
                Bibliografia geral do caso. O MVP ainda não associa uma fonte
                histórica específica a cada decisão.
              </p>
            </div>
          </div>

          {debrief.references.length > 0 ? (
            <ul className="debrief-reference-list">
              {debrief.references.map((reference) => (
                <ReferenceItem key={reference.id} reference={reference} />
              ))}
            </ul>
          ) : (
            <p className="debrief-empty-note">
              Nenhuma referência pública foi disponibilizada para este caso.
            </p>
          )}
        </section>

        <footer className="debrief-actions">
          <div>
            <strong>Próximo passo</strong>
            <p>Você pode refazer este caso sem apagar a tentativa concluída.</p>
          </div>
          <div className="action-row">
            <Link
              className="primary-action"
              to={`/simulacao?case=${encodeURIComponent(debrief.caseId)}`}
            >
              Refazer este caso
            </Link>
            <Link className="secondary-action" to="/curso">
              Voltar à seleção
            </Link>
          </div>
        </footer>
      </div>
    </section>
  )
}
