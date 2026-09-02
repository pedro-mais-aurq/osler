import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import { checkSupabaseConnection } from './services/supabaseHealth'
import './styles.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('[OSLER] Elemento raiz da aplicação não encontrado.')
}

if (import.meta.env.DEV) {
  void checkSupabaseConnection().then((result) => {
    const log = result.ok ? console.info : console.warn
    log(`[OSLER] ${result.message}`)
  })
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
