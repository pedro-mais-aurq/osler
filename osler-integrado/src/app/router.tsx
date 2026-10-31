import { createBrowserRouter, createHashRouter } from 'react-router-dom'
import { appRoutes } from './routes'
import { isLocalMode } from '../lib/dataMode'

// Hash routing also lets the complete local build open directly from disk.
export const router = (isLocalMode ? createHashRouter : createBrowserRouter)(
  appRoutes,
  { basename: isLocalMode ? '/' : import.meta.env.BASE_URL },
)
