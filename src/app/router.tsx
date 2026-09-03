import { createBrowserRouter } from 'react-router-dom'
import { App } from './App'
import { CourseSelectionPage } from '../pages/CourseSelectionPage'
import { EntryPage } from '../pages/EntryPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { ResultPage } from '../pages/ResultPage'
import { SimulationPage } from '../pages/SimulationPage'

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [
        { index: true, element: <EntryPage /> },
        { path: 'curso', element: <CourseSelectionPage /> },
        { path: 'simulacao', element: <SimulationPage /> },
        { path: 'resultado', element: <ResultPage /> },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
)
