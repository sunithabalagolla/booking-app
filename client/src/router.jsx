import { createBrowserRouter } from 'react-router'
import DashboardLayout from './components/layout/DashboardLayout.jsx'
import SiteLayout from './components/layout/SiteLayout.jsx'
import StaffLayout from './components/layout/StaffLayout.jsx'
import RoleRoute from './components/RoleRoute.jsx'
import AdminHomePage from './pages/admin/AdminHomePage.jsx'
import AdminMovieFormPage from './pages/admin/AdminMovieFormPage.jsx'
import AdminMoviesPage from './pages/admin/AdminMoviesPage.jsx'
import AdminOwnersPage from './pages/admin/AdminOwnersPage.jsx'
import AdminSettingsPage from './pages/admin/AdminSettingsPage.jsx'
import AdminTheatresPage from './pages/admin/AdminTheatresPage.jsx'
import OwnerFoodFormPage from './pages/owner/OwnerFoodFormPage.jsx'
import OwnerFoodPage from './pages/owner/OwnerFoodPage.jsx'
import OwnerHomePage from './pages/owner/OwnerHomePage.jsx'
import OwnerPendingPage from './pages/owner/OwnerPendingPage.jsx'
import OwnerShowFormPage from './pages/owner/OwnerShowFormPage.jsx'
import OwnerShowsPage from './pages/owner/OwnerShowsPage.jsx'
import OwnerScreenFormPage from './pages/owner/OwnerScreenFormPage.jsx'
import OwnerScreensPage from './pages/owner/OwnerScreensPage.jsx'
import OwnerTheatreFormPage from './pages/owner/OwnerTheatreFormPage.jsx'
import OwnerTheatresPage from './pages/owner/OwnerTheatresPage.jsx'
import OwnerSignupPage from './pages/owner/OwnerSignupPage.jsx'
import CheckEmailPage from './pages/public/CheckEmailPage.jsx'
import ForgotPasswordPage from './pages/public/ForgotPasswordPage.jsx'
import HomePage from './pages/public/HomePage.jsx'
import LoginPage from './pages/public/LoginPage.jsx'
import MovieDetailsPage from './pages/public/MovieDetailsPage.jsx'
import NotFoundPage from './pages/public/NotFoundPage.jsx'
import ResetPasswordPage from './pages/public/ResetPasswordPage.jsx'
import SearchPage from './pages/public/SearchPage.jsx'
import SignupPage from './pages/public/SignupPage.jsx'
import VerifyEmailPage from './pages/public/VerifyEmailPage.jsx'
import StaffScanPage from './pages/staff/StaffScanPage.jsx'
import SeatPage from './pages/user/SeatPage.jsx'
import { PUBLIC } from './store/authStore.js'

// All app routes live here. More pages are added phase by phase.
// Three layouts: SiteLayout (public + account pages), DashboardLayout (owner, admin),
// StaffLayout (Gate Staff). RoleRoute keeps each person on their own pages (ROLE-01).
// Account pages (login, sign up, verify, reset…) are open to everyone, so email links always work.
const guard = (allow, element) => <RoleRoute allow={allow}>{element}</RoleRoute>

const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      // Public browsing: guests and every role except Gate Staff (they go back to the scanner)
      { path: '/', element: guard(PUBLIC, <HomePage />) },
      // U-06 search + filters
      { path: '/movies', element: guard(PUBLIC, <SearchPage />) },
      // U-07 movie details (+ U-08 age warning)
      { path: '/movies/:id', element: guard(PUBLIC, <MovieDetailsPage />) },
      // U-10 seat selection (UI-20): login needed from here on (9.2), users only
      { path: '/shows/:id', element: guard(['user'], <SeatPage />) },
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
      { path: '/owner/pending', element: guard(['owner_pending'], <OwnerPendingPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  // Owner and admin register (UI-30). Wrong role → quietly to its own home.
  {
    element: guard(['owner', 'admin'], <DashboardLayout />),
    children: [
      { path: '/owner', element: guard(['owner'], <OwnerHomePage />) },
      // O-03 theatres
      { path: '/owner/theatres', element: guard(['owner'], <OwnerTheatresPage />) },
      { path: '/owner/theatres/new', element: guard(['owner'], <OwnerTheatreFormPage />) },
      { path: '/owner/theatres/:id', element: guard(['owner'], <OwnerTheatreFormPage />) },
      // O-04 screens + seat layout editor
      { path: '/owner/theatres/:id/screens', element: guard(['owner'], <OwnerScreensPage />) },
      { path: '/owner/theatres/:theatreId/screens/new', element: guard(['owner'], <OwnerScreenFormPage />) },
      { path: '/owner/screens/:id', element: guard(['owner'], <OwnerScreenFormPage />) },
      // O-07 canteen items
      { path: '/owner/theatres/:id/food', element: guard(['owner'], <OwnerFoodPage />) },
      { path: '/owner/theatres/:theatreId/food/new', element: guard(['owner'], <OwnerFoodFormPage />) },
      { path: '/owner/theatres/:theatreId/food/:foodId', element: guard(['owner'], <OwnerFoodFormPage />) },
      // O-05 shows
      { path: '/owner/shows', element: guard(['owner'], <OwnerShowsPage />) },
      { path: '/owner/shows/new', element: guard(['owner'], <OwnerShowFormPage />) },
      { path: '/owner/shows/:id', element: guard(['owner'], <OwnerShowFormPage />) },
      { path: '/admin', element: guard(['admin'], <AdminHomePage />) },
      // A-03 owner approvals
      { path: '/admin/owners', element: guard(['admin'], <AdminOwnersPage />) },
      // A-04 theatre approvals
      { path: '/admin/theatres', element: guard(['admin'], <AdminTheatresPage />) },
      // A-02 movies
      { path: '/admin/movies', element: guard(['admin'], <AdminMoviesPage />) },
      { path: '/admin/movies/new', element: guard(['admin'], <AdminMovieFormPage />) },
      { path: '/admin/movies/:id', element: guard(['admin'], <AdminMovieFormPage />) },
      // A-05 platform settings
      { path: '/admin/settings', element: guard(['admin'], <AdminSettingsPage />) },
    ],
  },
  // S-01 staff open straight to the scanner
  {
    element: guard(['staff'], <StaffLayout />),
    children: [{ path: '/staff/scan', element: <StaffScanPage /> }],
  },
])

export default router
