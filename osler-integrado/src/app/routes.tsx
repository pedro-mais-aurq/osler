import type { RouteObject } from 'react-router-dom'
import { App } from './App'
import { LandingPage } from '../pages/LandingPage'
import { NotFoundPage } from '../pages/NotFoundPage'

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    hydrateFallbackElement: <div className="boot-screen" role="status"><span>osler.</span><p>Preparando seu espaço de aprendizagem…</p></div>,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'projeto', lazy: async () => ({ Component: (await import('../pages/ProjectPage')).ProjectPage }) },
      { path: 'fundadores', lazy: async () => ({ Component: (await import('../pages/FoundersPage')).FoundersPage }) },
      { path: 'entrar', lazy: async () => ({ Component: (await import('../pages/EntryPage')).EntryPage }) },
      { path: 'demonstracao', lazy: async () => ({ Component: (await import('../pages/DemoPage')).DemoPage }) },
      { path: 'professor/*', lazy: async () => ({ Component: (await import('../pages/TeacherPage')).TeacherPage }) },
      { path: 'aluno', lazy: async () => ({ Component: (await import('../pages/StudentPage')).StudentPage }) },
      { path: 'auth/callback', lazy: async () => ({ Component: (await import('../pages/AuthCallbackPage')).AuthCallbackPage }) },
      { path: 'curso', lazy: async () => ({ Component: (await import('../pages/CourseSelectionPage')).CourseSelectionPage }) },
      { path: 'participacao', lazy: async () => ({ Component: (await import('../pages/ParticipationPage')).ParticipationPage }) },
      { path: 'casos-publicos', lazy: async () => ({ Component: (await import('../pages/PublicCasesPage')).PublicCasesPage }) },
      { path: 'simulacao', lazy: async () => ({ Component: (await import('../pages/SimulationPage')).SimulationPage }) },
      { path: 'resultado', lazy: async () => ({ Component: (await import('../pages/ResultPage')).ResultPage }) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
