import { useState } from 'react'
import { saveTeachingSubject } from '../../services/teaching'
export function TeachingSubject({ initial = '' }: { initial?: string }) {
 const [subject, setSubject] = useState(initial)
 const [busy, setBusy] = useState(false)
 const [message, setMessage] = useState('')
 return <section className="teaching-panel"><h1>Matéria lecionada</h1><p>Informe a matéria que você leciona. A formação de cada turma será definida ao criá-la.</p><form className="teaching-form" onSubmit={async event => { event.preventDefault(); setBusy(true); const result = await saveTeachingSubject(subject); setMessage(result.ok ? 'Matéria salva.' : result.message); setBusy(false) }}><label className="teaching-field">Matéria<input required maxLength={160} value={subject} onChange={event => setSubject(event.target.value)} /></label><button className="primary-action" disabled={busy}>{busy ? 'Salvando…' : 'Salvar matéria'}</button>{message && <p role="status">{message}</p>}</form></section>
}
