import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './theme/theme.css'
// In React Router v8, RouterProvider comes from 'react-router/dom'
import { RouterProvider } from 'react-router/dom'
import AuthManager from './api/AuthManager.jsx'
import router from './router.jsx'
import ThemeManager from './theme/ThemeManager.jsx'

// TanStack Query keeps API data (Section 2)
const queryClient = new QueryClient()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeManager />
      <AuthManager />
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
