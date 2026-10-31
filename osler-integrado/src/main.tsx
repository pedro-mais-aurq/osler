import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import './styles.css'
import './features/simulation/simulation.css'
import './features/debrief/debrief.css'
import './frontend.css'
import './neres-osler.css'
import './public-pages.css'
import './features/teaching/teaching.css'
import './integration.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('[OSLER] Elemento raiz da aplicação não encontrado.')
}

if (import.meta.env.DEV && import.meta.env.VITE_DATA_MODE !== 'local' && import.meta.env.MODE !== 'demo' && import.meta.env.VITE_SUPABASE_URL && (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY)) {
  void import('./services/supabaseHealth').then(({ checkSupabaseConnection }) => checkSupabaseConnection()).then((result) => {
    const log = result.ok ? console.info : console.warn
    log(`[OSLER] ${result.message}`)
  })
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
