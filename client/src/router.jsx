import { createBrowserRouter } from 'react-router'
import CheckEmailPage from './pages/public/CheckEmailPage.jsx'
import ForgotPasswordPage from './pages/public/ForgotPasswordPage.jsx'
import HomePage from './pages/public/HomePage.jsx'
import LoginPage from './pages/public/LoginPage.jsx'
import NotFoundPage from './pages/public/NotFoundPage.jsx'
import ResetPasswordPage from './pages/public/ResetPasswordPage.jsx'
import SignupPage from './pages/public/SignupPage.jsx'
import VerifyEmailPage from './pages/public/VerifyEmailPage.jsx'

// All app routes live here. More pages are added phase by phase.
const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  // U-01 sign up + verify email
  { path: '/signup', element: <SignupPage /> },
  { path: '/check-email', element: <CheckEmailPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  // U-02 login
  { path: '/login', element: <LoginPage /> },
  // U-03 forgot / reset password
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '*', element: <NotFoundPage /> },
])

export default router
