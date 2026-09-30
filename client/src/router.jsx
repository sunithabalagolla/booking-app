import { createBrowserRouter } from 'react-router'
import CheckEmailPage from './pages/public/CheckEmailPage.jsx'
import HomePage from './pages/public/HomePage.jsx'
import NotFoundPage from './pages/public/NotFoundPage.jsx'
import SignupPage from './pages/public/SignupPage.jsx'
import VerifyEmailPage from './pages/public/VerifyEmailPage.jsx'

// All app routes live here. More pages are added phase by phase.
const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  // U-01 sign up + verify email
  { path: '/signup', element: <SignupPage /> },
  { path: '/check-email', element: <CheckEmailPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  { path: '*', element: <NotFoundPage /> },
])

export default router
