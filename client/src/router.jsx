import { createBrowserRouter } from 'react-router'
import RoleRoute from './components/RoleRoute.jsx'
import AdminHomePage from './pages/admin/AdminHomePage.jsx'
import CheckEmailPage from './pages/public/CheckEmailPage.jsx'
import ForgotPasswordPage from './pages/public/ForgotPasswordPage.jsx'
import HomePage from './pages/public/HomePage.jsx'
import LoginPage from './pages/public/LoginPage.jsx'
import OwnerHomePage from './pages/owner/OwnerHomePage.jsx'
import OwnerPendingPage from './pages/owner/OwnerPendingPage.jsx'
import OwnerSignupPage from './pages/owner/OwnerSignupPage.jsx'
import NotFoundPage from './pages/public/NotFoundPage.jsx'
import ResetPasswordPage from './pages/public/ResetPasswordPage.jsx'
import SignupPage from './pages/public/SignupPage.jsx'
import StaffScanPage from './pages/staff/StaffScanPage.jsx'
import VerifyEmailPage from './pages/public/VerifyEmailPage.jsx'
import { PUBLIC } from './store/authStore.js'

// All app routes live here. More pages are added phase by phase.
// Account pages (login, sign up, verify, reset…) are open to everyone, so email links always work.
const router = createBrowserRouter([
  // Public browsing: guests and every role except Gate Staff (they go back to the scanner)
  {
    path: '/',
    element: (
      <RoleRoute allow={PUBLIC}>
        <HomePage />
      </RoleRoute>
    ),
  },
  // U-01 sign up + verify email
  { path: '/signup', element: <SignupPage /> },
  { path: '/check-email', element: <CheckEmailPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  // U-02 login
  { path: '/login', element: <LoginPage /> },
  // U-03 forgot / reset password
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  // O-01 owner register + waiting for approval
  { path: '/owner/signup', element: <OwnerSignupPage /> },
  {
    path: '/owner/pending',
    element: (
      <RoleRoute allow={['owner_pending']}>
        <OwnerPendingPage />
      </RoleRoute>
    ),
  },
  // Role home pages (ROLE-01). Wrong role → quietly to its own home.
  {
    path: '/owner',
    element: (
      <RoleRoute allow={['owner']}>
        <OwnerHomePage />
      </RoleRoute>
    ),
  },
  {
    path: '/admin',
    element: (
      <RoleRoute allow={['admin']}>
        <AdminHomePage />
      </RoleRoute>
    ),
  },
  // S-01 staff open straight to the scanner
  {
    path: '/staff/scan',
    element: (
      <RoleRoute allow={['staff']}>
        <StaffScanPage />
      </RoleRoute>
    ),
  },
  { path: '*', element: <NotFoundPage /> },
])

export default router
