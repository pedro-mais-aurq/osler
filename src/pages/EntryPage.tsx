import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ensureAnonymousStudentSession } from '../services/auth'
import { getCurrentStudentCourse } from '../services/student'

export function EntryPage() {
  const navigate = useNavigate()
  const inFlight = useRef(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function enterAsStudent() {
    if (inFlight.current) {
      return
    }

    inFlight.current = true
    setStatus('loading')
    setErrorMessage(null)

    const authResult = await ensureAnonymousStudentSession()

    if (!authResult.ok) {
      if (import.meta.env.DEV) {
        console.error('Falha ao iniciar sessão anônima.', authResult.cause)
      }

      setStatus('error')
      setErrorMessage(authResult.message)
      inFlight.current = false
      return
    }

    const studentResult = await getCurrentStudentCourse()

    if (!studentResult.ok) {
      if (import.meta.env.DEV) {
        console.error('Falha ao carregar estudante.', studentResult.cause)
      }

      setStatus('error')
      setErrorMessage(studentResult.message)
      inFlight.current = false
      return
    }

    navigate(studentResult.course ? '/simulacao' : '/curso')
  }

  return (
    <section className="page-card" aria-labelledby="entry-title">
      <p className="eyebrow">Simulação clínica interprofissional</p>
      <h1 id="entry-title">Como você quer entrar?</h1>
      <p>
        Escolha seu papel para continuar. O fluxo do aluno usa uma identidade anônima e
        não solicita dados pessoais.
      </p>

      <div className="action-row" aria-busy={status === 'loading'}>
        <button
          className="primary-action"
          disabled={status === 'loading'}
          onClick={enterAsStudent}
          type="button"
        >
          {status === 'loading' ? 'Iniciando sessão…' : 'Sou aluno'}
        </button>
        <Link className="secondary-action" to="/professor">
          Sou professor
        </Link>
      </div>

      {status === 'error' && errorMessage ? (
        <div className="status-message status-error" role="alert">
          <p>{errorMessage}</p>
          <button className="text-action" onClick={enterAsStudent} type="button">
            Tentar novamente
          </button>
        </div>
      ) : null}
    </section>
  )
}
