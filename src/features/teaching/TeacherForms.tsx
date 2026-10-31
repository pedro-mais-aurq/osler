import { useState, type FormEvent } from 'react'
import type { Classroom, ServiceResult, TeachingCase } from './types'
import { courseLabels } from './validation'
import { Dialog } from './ui'

interface FormBase {
  busy: boolean
  onClose: () => void
}
export function ClassroomForm({
  classroom,
  busy,
  onClose,
  onSave,
}: FormBase & {
  classroom?: Classroom
  onSave: (
    input: Pick<Classroom, 'name' | 'course' | 'term' | 'description'>,
  ) => Promise<ServiceResult<unknown>>
}) {
  const [input, setInput] = useState({
    name: classroom?.name ?? '',
    course: classroom?.course ?? 'nursing',
    term: classroom?.term ?? '',
    description: classroom?.description ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault()
    const r = await onSave(input)
    if (!r.ok) setError(r.message)
  }
  return (
    <Dialog title={classroom ? 'Editar turma' : 'Nova turma'} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="teaching-form">
        <label className="teaching-field">
          Nome da turma
          <input
            required
            maxLength={120}
            value={input.name}
            onChange={(e) => setInput({ ...input, name: e.target.value })}
            placeholder="Ex.: Enfermagem · Turma B"
          />
        </label>
        <label className="teaching-field">
          Curso
          <select
            value={input.course}
            onChange={(e) =>
              setInput({
                ...input,
                course: e.target.value as Classroom['course'],
              })
            }
          >
            {Object.entries(courseLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="teaching-field">
          Período
          <input
            maxLength={120}
            value={input.term}
            onChange={(e) => setInput({ ...input, term: e.target.value })}
            placeholder="Ex.: 2º semestre de 2026"
          />
        </label>
        <label className="teaching-field">
          Descrição
          <textarea
            rows={3}
            maxLength={2000}
            value={input.description}
            onChange={(e) =>
              setInput({ ...input, description: e.target.value })
            }
          />
        </label>
        {error && (
          <p className="teaching-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-action" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar turma'}
        </button>
      </form>
    </Dialog>
  )
}
export function InviteForm({
  busy,
  onClose,
  onSave,
}: FormBase & {
  onSave: (emails: string[]) => Promise<ServiceResult<unknown>>
}) {
  const [emails, setEmails] = useState(''),
    [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault()
    const r = await onSave(emails.split(/[\s,;]+/).filter(Boolean))
    if (!r.ok) setError(r.message)
  }
  return (
    <Dialog title="Adicionar alunos por e-mail" onClose={onClose}>
      <p className="muted">
        Cadastre o mesmo e-mail que o aluno usará no Google. O vínculo será
        concluído no primeiro acesso.
      </p>
      <form className="teaching-form" onSubmit={(e) => void submit(e)}>
        <label className="teaching-field">
          E-mails dos alunos
          <textarea
            rows={6}
            required
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder={'ana@exemplo.com\nlucas@exemplo.com'}
          />
          <small>
            Separe por linha, vírgula ou ponto e vírgula. Até 100 por vez.
          </small>
        </label>
        <p className="muted">
          Este cadastro libera o acesso à turma. Nenhuma mensagem de e-mail é
          enviada.
        </p>
        {error && (
          <p className="teaching-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary-action" disabled={busy}>
          {busy ? 'Adicionando…' : 'Adicionar à turma'}
        </button>
      </form>
    </Dialog>
  )
}
export function AssignmentForm({
  cases,
  busy,
  onClose,
  onSave,
}: FormBase & {
  cases: TeachingCase[]
  onSave: (
    caseId: string,
    title: string,
    dueAt: string | null,
  ) => Promise<ServiceResult<unknown>>
}) {
  const [caseId, setCaseId] = useState(cases[0]?.id ?? ''),
    [title, setTitle] = useState(''),
    [due, setDue] = useState(''),
    [error, setError] = useState<string | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault()
    const r = await onSave(
      caseId,
      title,
      due ? new Date(due).toISOString() : null,
    )
    if (!r.ok) setError(r.message)
  }
  return (
    <Dialog title="Disponibilizar um caso" onClose={onClose}>
      {cases.length ? (
        <form className="teaching-form" onSubmit={(e) => void submit(e)}>
          <label className="teaching-field">
            Caso clínico publicado
            <select value={caseId} onChange={(e) => setCaseId(e.target.value)}>
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.draft.title}
                </option>
              ))}
            </select>
          </label>
          <label className="teaching-field">
            Nome da atividade
            <input
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Atividade 02 · Acolhimento"
            />
          </label>
          <label className="teaching-field">
            Prazo sugerido
            <input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
            <small>
              O prazo orienta a turma. Use “Encerrar” para bloquear novas
              decisões.
            </small>
          </label>
          {error && (
            <p className="teaching-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-action" disabled={busy}>
            {busy ? 'Salvando…' : 'Disponibilizar para a turma'}
          </button>
        </form>
      ) : (
        <p>
          Publique um caso do mesmo curso da turma antes de criar uma atividade.
        </p>
      )}
    </Dialog>
  )
}
