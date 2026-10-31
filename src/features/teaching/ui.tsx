import {
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { signOutPortal } from '../../services/teaching'
import type { PortalIdentity } from './types'
import './teaching.css'

const iconPaths: Record<string, ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  classes: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      <circle cx="9" cy="7" r="4" />
    </>
  ),
  cases: (
    <>
      <rect x="5" y="4" width="14" height="18" rx="2" />
      <path d="M9 2h6v4H9zm0 9h6m-6 4h6m-6 4h3" />
    </>
  ),
  debrief: (
    <>
      <path d="M21 15a4 4 0 0 1-4 4H7l-5 3V6a4 4 0 0 1 4-4h11a4 4 0 0 1 4 4zM7 7h9M7 12h6" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  logout: <path d="M9 3H4v18h5m6-5 5-4-5-4m-6 4h11" />,
}
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name] ?? iconPaths.cases}
    </svg>
  )
}
export function PortalLayout({
  identity,
  children,
}: PropsWithChildren<{ identity: PortalIdentity }>) {
  const navigate = useNavigate(),
    [error, setError] = useState<string | null>(null)
  const teacher = identity.role === 'teacher' || identity.role === 'admin'
  const links = teacher
    ? [
        ['/professor', 'Visão geral', 'overview'],
        ['/professor/turmas', 'Minhas turmas', 'classes'],
        ['/professor/casos', 'Casos clínicos', 'cases'],
        ['/professor/debriefings', 'Debriefings', 'debrief'],
      ]
    : [['/aluno', 'Minhas atividades', 'cases']]
  return (
    <div className="teaching-layout">
      <aside className="teaching-sidebar">
        <p className="sidebar-caption">
          {teacher ? 'ESPAÇO DO PROFESSOR' : 'ESPAÇO DO ALUNO'}
        </p>
        <nav aria-label={teacher ? 'Área do professor' : 'Área do aluno'}>
          {links.map(([to, label, icon]) => (
            <NavLink end={to === '/professor'} key={to} to={to}>
              <Icon name={icon} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <Icon name="debrief" size={26} />
          <strong>Aprender é refletir.</strong>
          <p>Cada decisão abre uma conversa sobre o cuidado.</p>
        </div>
        <div className="sidebar-profile">
          <span className="user-avatar">
            {identity.displayName
              .replace('Prof.ª ', '')
              .split(' ')
              .map((w) => w[0])
              .slice(0, 2)
              .join('')}
          </span>
          <div>
            <strong>{identity.displayName}</strong>
            <small>{identity.email}</small>
          </div>
        </div>
        <button
          className="sidebar-signout"
          type="button"
          onClick={async () => {
            const result = await signOutPortal()
            if (result.ok) navigate('/')
            else setError(result.message)
          }}
        >
          <Icon name="logout" size={17} />
          Sair da conta
        </button>
        {error && <p role="alert">{error}</p>}
      </aside>
      <div className="teaching-content">{children}</div>
    </div>
  )
}
export function PageHeading({
  eyebrow,
  title,
  children,
  action,
}: PropsWithChildren<{ eyebrow: string; title: string; action?: ReactNode }>) {
  return (
    <div className="teaching-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  )
}
export function EmptyState({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <div className="teaching-empty">
      <Icon name="cases" size={30} />
      <h3>{title}</h3>
      {children}
    </div>
  )
}
export function AccessState({
  loading,
  error,
  retry,
}: {
  loading?: boolean
  error?: string | null
  retry?: () => void
}) {
  return (
    <section className="page-card">
      <p className="eyebrow">OSLER · Sala de aula</p>
      <h1>{loading ? 'Preparando seu espaço' : 'Acesso à sua conta'}</h1>
      <p role={error ? 'alert' : 'status'}>
        {loading
          ? 'Carregando seu perfil…'
          : error || 'Entre com sua conta para acessar esta área.'}
      </p>
      <div className="action-row">
        {retry && (
          <button className="primary-action" onClick={retry}>
            Tentar novamente
          </button>
        )}
        <Link className="secondary-action" to="/entrar">
          Voltar à entrada
        </Link>
      </div>
    </section>
  )
}
export function Dialog({
  title,
  onClose,
  children,
}: PropsWithChildren<{ title: string; onClose: () => void }>) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current
      ?.querySelector<HTMLElement>('input,textarea,select,button')
      ?.focus()
    return () => {
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])
  return (
    <div className="teaching-dialog-backdrop">
      <div
        aria-label={title}
        aria-modal="true"
        role="dialog"
        className="teaching-dialog"
        ref={ref}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
          if (event.key === 'Tab') {
            const items = Array.from(
              ref.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]',
              ) ?? [],
            )
            const first = items[0],
              last = items.at(-1)
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault()
              last?.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first?.focus()
            }
          }
        }}
      >
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Fechar janela"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
export const dateLabel = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(value))
    : 'Sem prazo'
export const statusLabel = {
  completed: 'Concluída',
  in_progress: 'Em andamento',
  abandoned: 'Interrompida',
  draft: 'Rascunho',
  published: 'Publicado',
  archived: 'Arquivado',
  open: 'Aberta',
  closed: 'Encerrada',
  invited: 'Aguardando acesso',
  active: 'Vinculado',
  revoked: 'Removido',
}
