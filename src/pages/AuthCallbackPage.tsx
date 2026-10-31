import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getPortalIdentity } from '../services/teaching'
import { loginCourseKey, parseEntryCourse } from '../features/onboarding/entryIntent'
export function AuthCallbackPage() {
  const navigate = useNavigate(),
    [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    async function complete() {
      if (new URLSearchParams(window.location.search).has('error')) {
        setError(
          'O login não foi concluído. Volte à entrada e tente novamente.',
        )
        return
      }
      const destination = sessionStorage.getItem('osler.login.destination')
      const result = await getPortalIdentity(destination === 'teacher' || destination === 'student' ? destination : undefined)
      if (!active) return
      if (!result.ok || !result.value) {
        setError(
          result.ok
            ? 'Nenhuma sessão foi encontrada. Inicie o login novamente.'
            : result.message,
        )
        return
      }
      const course = parseEntryCourse(sessionStorage.getItem(loginCourseKey))
      sessionStorage.removeItem('osler.login.destination')
      sessionStorage.removeItem(loginCourseKey)
      navigate(
        result.value.role !== 'student'
          ? '/professor'
          : course ? `/curso?curso=${course}` : '/curso',
        { replace: true },
      )
    }
    void complete()
    return () => {
      active = false
    }
  }, [navigate])
  return (
    <section className="page-card">
      <p className="eyebrow">Login Google</p>
      <h1>{error ? 'Não foi possível entrar' : 'Preparando seu acesso'}</h1>
      <p role={error ? 'alert' : 'status'}>
        {error || 'Verificando sua conta e vinculando suas turmas…'}
      </p>
      {error && (
        <Link className="secondary-action" to="/entrar">
          Voltar à entrada
        </Link>
      )}
    </section>
  )
}
