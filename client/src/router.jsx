import { createBrowserRouter } from 'react-router'
import HomePage from './pages/public/HomePage.jsx'
import NotFoundPage from './pages/public/NotFoundPage.jsx'

// All app routes live here. More pages are added phase by phase.
const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '*', element: <NotFoundPage /> },
])

export default router
