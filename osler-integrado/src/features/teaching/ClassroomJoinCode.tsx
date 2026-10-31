import { useState } from 'react'

export function ClassroomJoinCode({ code }: { code: string }) {
  const [message, setMessage] = useState('')
  async function copy() {
    try { await navigator.clipboard.writeText(code); setMessage('Código copiado.') }
    catch { setMessage('Selecione o código para copiá-lo manualmente.') }
  }
  return <section className="classroom-join-code" aria-label="Código de entrada da turma"><div><strong>Código para entrar na turma</strong><p>Compartilhe com os alunos que você quer receber nesta turma.</p><code>{code}</code></div><button className="secondary-action" type="button" onClick={() => void copy()}>Copiar código</button>{message && <p role="status">{message}</p>}</section>
}
