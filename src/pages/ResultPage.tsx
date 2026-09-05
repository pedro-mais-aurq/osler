import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import '../features/debrief/debrief.css'
import { isValidDebriefSessionId } from '../features/debrief/parsers'
import type { SimulationDebrief } from '../features/debrief/types'
import { DebriefView } from '../features/debrief/ui/DebriefView'
import { getSimulationDebrief } from '../services/debrief'

type ResultPageState =
  | { status: 'loading' }
  | { status: 'ready'; debrief: SimulationDebrief }
  | { status: 'unavailable' }
  | { status: 'error'; message: string }

export function ResultPage() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session')
  const [reloadToken, setReloadToken] = useState(0)
  const [pageState, setPageState] = useState<ResultPageState>({
    status: 'loading',
  })

  useEffect(() => {
    let active = true

    async function loadDebrief() {
      if (!isValidDebriefSessionId(sessionId)) {
        setPageState({ status: 'unavailable' })
        return
      }

      setPageState({ status: 'loading' })
      const result = await getSimulationDebrief(sessionId)

      if (!active) {
        return
      }

      if (!result.ok) {
        if (result.reason === 'unavailable') {
          setPageState({ status: 'unavailable' })
          return
        }

        if (import.meta.env.DEV) {
          console.error('Falha ao carregar debrief.', result.cause)
        }

        setPageState({ status: 'error', message: result.message })
        return
      }

      setPageState({ status: 'ready', debrief: result.debrief })
    }

    void loadDebrief()

    return () => {
      active = false
    }
  }, [reloadToken, sessionId])

  if (pageState.status === 'loading') {
    return (
      <section className="page-card" aria-labelledby="result-title">
        <p className="eyebrow">Resultado</p>
        <h1 id="result-title">Preparando seu debriefing</h1>
        <p className="status-message" role="status">
          Carregando a trajetória registrada desta tentativa…
        </p>
      </section>
    )
  }

  if (pageState.status === 'unavailable') {
    return (
      <section className="page-card" aria-labelledby="result-title">
        <p className="eyebrow">Resultado</p>
        <h1 id="result-title">Resultado indisponível</h1>
        <p>Este resultado não está disponível.</p>
        <div className="action-row">
          <Link className="primary-action" to="/simulacao">
            Voltar à simulação
          </Link>
          <Link className="secondary-action" to="/curso">
            Voltar à seleção
          </Link>
        </div>
      </section>
    )
  }

  if (pageState.status === 'error') {
    return (
      <section className="page-card" aria-labelledby="result-title">
        <p className="eyebrow">Resultado</p>
        <h1 id="result-title">Não foi possível carregar o debriefing</h1>
        <div className="status-message status-error" role="alert">
          <p>{pageState.message}</p>
          <button
            className="text-action"
            onClick={() => setReloadToken((value) => value + 1)}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
        <Link className="secondary-action" to="/curso">
          Voltar à seleção
        </Link>
      </section>
    )
  }

  return <DebriefView debrief={pageState.debrief} />
}
