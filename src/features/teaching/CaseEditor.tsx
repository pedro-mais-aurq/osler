import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type {
  AuthorStep,
  CaseDraft,
  ServiceResult,
  TeachingCase,
} from './types'
import {
  classificationLabels,
  courseLabels,
  newCaseDraft,
  newOption,
  newStep,
  presentationLabels,
  validateDraft,
} from './validation'
import { Icon, PageHeading } from './ui'

export function CaseEditor({
  initial,
  existing,
  busy,
  onSave,
}: {
  initial?: CaseDraft
  existing?: TeachingCase
  busy: boolean
  onSave: (draft: CaseDraft, publish: boolean) => Promise<ServiceResult<string>>
}) {
  const [draft, setDraft] = useState<CaseDraft>(() =>
    ({ visibility: 'private', ...structuredClone(existing?.draft ?? initial ?? newCaseDraft()) }),
  )
  const [error, setError] = useState<string | null>(null)
  const readOnly = !!existing && existing.status !== 'draft'
  const update = <K extends keyof CaseDraft>(key: K, value: CaseDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))
  const stepUpdate = (index: number, change: Partial<AuthorStep>) =>
    setDraft((d) => ({
      ...d,
      steps: d.steps.map((s, i) => (i === index ? { ...s, ...change } : s)),
    }))
  async function submit(event: FormEvent, publish = false) {
    event.preventDefault()
    const validation = validateDraft(draft, publish)
    if (validation) {
      setError(validation)
      return
    }
    setError(null)
    const result = await onSave(draft, publish)
    if (!result.ok) setError(result.message)
  }
  return (
    <>
      <Link className="back-link" to="/professor/casos">
        ← Casos clínicos
      </Link>
      <PageHeading
        eyebrow="AUTORIA DE CASOS"
        title={
          existing
            ? existing.status === 'draft'
              ? 'Editar caso clínico'
              : 'Caso publicado'
            : 'Novo caso clínico'
        }
      >
        Transforme um objetivo de aprendizagem em uma sequência de decisões.
      </PageHeading>
      {readOnly && (
        <p className="teaching-notice">
          Este conteúdo está preservado. Para alterar as etapas ou avaliações,
          volte à lista e duplique o caso.
        </p>
      )}
      <form className="case-editor" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={readOnly || busy} className="editor-fieldset">
          <section className="teaching-panel">
            <div className="panel-heading">
              <span className="section-number">01</span>
              <h2>Contexto e objetivo</h2>
            </div>
            <div className="form-grid">
              <label className="teaching-field span-2">
                Título do caso
                <input
                  required
                  maxLength={160}
                  value={draft.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="Ex.: Comunicação no acolhimento"
                />
              </label>
              <label className="teaching-field">
                Curso
                <select
                  value={draft.course}
                  onChange={(e) =>
                    update('course', e.target.value as CaseDraft['course'])
                  }
                >
                  {Object.entries(courseLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="teaching-field span-2">
                <span id="case-visibility-label">Visibilidade do caso</span>
                <select aria-labelledby="case-visibility-label" aria-describedby="case-visibility-help" value={draft.visibility ?? 'private'} onChange={event => update('visibility', event.target.value as 'private' | 'public')}>
                  <option value="private">Privado — somente nas turmas autorizadas</option>
                  <option value="public">Público — disponível para prática individual</option>
                </select>
                <small id="case-visibility-help">{draft.visibility === 'public' ? 'Após a publicação, qualquer aluno da plataforma poderá praticar este caso sem entrar em uma turma.' : 'Após a publicação, o caso ficará disponível apenas nas atividades das turmas em que você o disponibilizar.'}</small>
              </label>
              <label className="teaching-field">
                Paciente fictício
                <input
                  maxLength={120}
                  value={draft.patientName}
                  onChange={(e) => update('patientName', e.target.value)}
                />
              </label>
              <label className="teaching-field">
                Idade
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={draft.patientAge}
                  onChange={(e) => update('patientAge', Number(e.target.value))}
                />
              </label>
              <label className="teaching-field">
                Pronomes
                <input
                  maxLength={80}
                  value={draft.pronouns}
                  onChange={(e) => update('pronouns', e.target.value)}
                  placeholder="ela/dela"
                />
              </label>
              <label className="teaching-field span-2">
                Apresentação do caso
                <textarea
                  maxLength={4000}
                  rows={3}
                  value={draft.description}
                  onChange={(e) => update('description', e.target.value)}
                />
              </label>
              <label className="teaching-field span-2">
                Objetivo de aprendizagem
                <textarea
                  maxLength={2000}
                  rows={2}
                  value={draft.objective}
                  onChange={(e) => update('objective', e.target.value)}
                />
              </label>
            </div>
          </section>
          <section className="editor-steps">
            <div className="panel-heading">
              <span className="section-number">02</span>
              <div>
                <h2>Trajetória da simulação</h2>
                <p>
                  As regras de cada alternativa ficam disponíveis apenas para o
                  autor.
                </p>
              </div>
            </div>
            {draft.steps.map((step, index) => (
              <article className="teaching-panel editor-step" key={step.key}>
                <div className="panel-heading">
                  <span className="step-marker">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3>{step.type === 'decision' ? 'Decisão' : 'Informação'}</h3>
                  <div className="push-right inline-actions">
                    <button
                      type="button"
                      className="small-action"
                      aria-label={`Mover etapa ${index + 1} para cima`}
                      disabled={index === 0}
                      onClick={() => {
                        const steps = [...draft.steps]
                        ;[steps[index - 1], steps[index]] = [
                          steps[index],
                          steps[index - 1],
                        ]
                        update('steps', steps)
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="small-action"
                      aria-label={`Mover etapa ${index + 1} para baixo`}
                      disabled={index === draft.steps.length - 1}
                      onClick={() => {
                        const steps = [...draft.steps]
                        ;[steps[index + 1], steps[index]] = [
                          steps[index],
                          steps[index + 1],
                        ]
                        update('steps', steps)
                      }}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="small-action danger"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remover a etapa ${index + 1}? Revise os destinos das alternativas que apontam para ela.`,
                          )
                        )
                          update(
                            'steps',
                            draft.steps.filter((_, i) => i !== index),
                          )
                      }}
                    >
                      Remover
                    </button>
                  </div>
                </div>
                <div className="form-grid">
                  <label className="teaching-field">
                    Título da etapa
                    <input
                      maxLength={160}
                      value={step.title}
                      onChange={(e) =>
                        stepUpdate(index, { title: e.target.value })
                      }
                    />
                  </label>
                  <label className="teaching-field">
                    Estado visual inicial
                    <select
                      value={step.presentationState}
                      onChange={(e) =>
                        stepUpdate(index, {
                          presentationState: e.target
                            .value as AuthorStep['presentationState'],
                        })
                      }
                    >
                      {Object.entries(presentationLabels).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="teaching-field span-2">
                    Contexto apresentado ao aluno
                    <textarea
                      rows={3}
                      maxLength={8000}
                      value={step.body}
                      onChange={(e) =>
                        stepUpdate(index, { body: e.target.value })
                      }
                    />
                  </label>
                  <label className="teaching-field span-2">
                    Observações, uma por linha
                    <textarea
                      rows={2}
                      value={step.observations.join('\n')}
                      onChange={(e) =>
                        stepUpdate(index, {
                          observations: e.target.value.split('\n'),
                        })
                      }
                    />
                  </label>
                </div>
                {step.type === 'decision' && (
                  <div className="author-options">
                    {step.options.map((option, oi) => {
                      const optionUpdate = (change: Partial<typeof option>) =>
                        stepUpdate(index, {
                          options: step.options.map((o, i) =>
                            i === oi ? { ...o, ...change } : o,
                          ),
                        })
                      return (
                        <div className="author-option" key={option.id}>
                          <div className="panel-heading">
                            <strong>
                              Alternativa {String.fromCharCode(65 + oi)}
                            </strong>
                            <button
                              className="text-action push-right danger"
                              type="button"
                              disabled={step.options.length <= 2}
                              onClick={() =>
                                stepUpdate(index, {
                                  options: step.options.filter(
                                    (_, i) => i !== oi,
                                  ),
                                })
                              }
                            >
                              Remover alternativa
                            </button>
                          </div>
                          <div className="form-grid">
                            <label className="teaching-field span-2">
                              Texto da alternativa
                              <textarea
                                maxLength={2000}
                                rows={2}
                                value={option.label}
                                onChange={(e) =>
                                  optionUpdate({ label: e.target.value })
                                }
                              />
                            </label>
                            <label className="teaching-field">
                              Classificação
                              <select
                                value={option.classification}
                                onChange={(e) =>
                                  optionUpdate({
                                    classification: e.target
                                      .value as typeof option.classification,
                                  })
                                }
                              >
                                {Object.entries(classificationLabels).map(
                                  ([v, l]) => (
                                    <option key={v} value={v}>
                                      {l}
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>
                            <label className="teaching-field">
                              Variação de pontuação
                              <input
                                type="number"
                                min={-100}
                                max={100}
                                value={option.scoreDelta}
                                onChange={(e) =>
                                  optionUpdate({
                                    scoreDelta: Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                            <label className="teaching-field span-2">
                              Feedback pedagógico
                              <textarea
                                rows={2}
                                maxLength={4000}
                                value={option.feedback}
                                onChange={(e) =>
                                  optionUpdate({ feedback: e.target.value })
                                }
                              />
                            </label>
                            <label className="teaching-field span-2">
                              Consequência observável
                              <textarea
                                rows={2}
                                maxLength={2000}
                                value={option.consequence}
                                onChange={(e) =>
                                  optionUpdate({ consequence: e.target.value })
                                }
                              />
                            </label>
                            <label className="teaching-field">
                              Estado após a escolha
                              <select
                                value={option.presentationState}
                                onChange={(e) =>
                                  optionUpdate({
                                    presentationState: e.target
                                      .value as typeof option.presentationState,
                                  })
                                }
                              >
                                {Object.entries(presentationLabels).map(
                                  ([v, l]) => (
                                    <option key={v} value={v}>
                                      {l}
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>
                            <label className="teaching-field">
                              Destino
                              <select
                                value={option.nextStepKey}
                                onChange={(e) =>
                                  optionUpdate({ nextStepKey: e.target.value })
                                }
                              >
                                <option value="next">Próxima etapa</option>
                                <option value="complete">
                                  Concluir simulação
                                </option>
                                {draft.steps
                                  .slice(index + 1)
                                  .map((target, ti) => (
                                    <option key={target.key} value={target.key}>
                                      {index + ti + 2}.{' '}
                                      {target.title || 'Sem título'}
                                    </option>
                                  ))}
                              </select>
                            </label>
                          </div>
                        </div>
                      )
                    })}
                    <button
                      type="button"
                      className="secondary-action"
                      disabled={step.options.length >= 8}
                      onClick={() =>
                        stepUpdate(index, {
                          options: [...step.options, newOption()],
                        })
                      }
                    >
                      <Icon name="plus" size={17} />
                      Adicionar alternativa
                    </button>
                  </div>
                )}
              </article>
            ))}
            <div className="inline-actions">
              <button
                type="button"
                className="secondary-action"
                disabled={draft.steps.length >= 30}
                onClick={() => update('steps', [...draft.steps, newStep()])}
              >
                <Icon name="plus" size={17} />
                Etapa informativa
              </button>
              <button
                type="button"
                className="secondary-action"
                disabled={draft.steps.length >= 30}
                onClick={() =>
                  update('steps', [...draft.steps, newStep('decision')])
                }
              >
                <Icon name="plus" size={17} />
                Etapa de decisão
              </button>
            </div>
          </section>
          <section className="teaching-panel">
            <div className="panel-heading">
              <span className="section-number">03</span>
              <h2>Revisão e publicação</h2>
            </div>
            <label className="teaching-field">
              Referências e fundamentação
              <textarea
                rows={3}
                maxLength={4000}
                value={draft.reference}
                onChange={(e) => update('reference', e.target.value)}
                placeholder="Informe fontes, protocolos e a versão utilizada."
              />
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={draft.reviewed}
                onChange={(e) => update('reviewed', e.target.checked)}
              />
              Confirmo que revisei o conteúdo clínico, as regras e a adequação
              pedagógica deste caso.
            </label>
            <p className="muted">
              Publicar preserva esta versão. Depois, você poderá
              disponibilizá-la para uma turma ou duplicá-la para revisão.
            </p>
          </section>
        </fieldset>
        {error && (
          <p className="teaching-error" role="alert">
            {error}
          </p>
        )}
        {!readOnly && (
          <div className="editor-actions">
            <Link className="secondary-action" to="/professor/casos">
              Cancelar
            </Link>
            <button className="secondary-action" disabled={busy} type="submit">
              {busy ? 'Salvando…' : 'Salvar rascunho'}
            </button>
            <button
              className="primary-action"
              disabled={busy}
              type="button"
              onClick={(event) => void submit(event, true)}
            >
              Publicar caso
            </button>
          </div>
        )}
      </form>
    </>
  )
}
