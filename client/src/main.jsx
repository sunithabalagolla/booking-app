import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme/theme.css'
// In React Router v8, RouterProvider comes from 'react-router/dom'
import { RouterProvider } from 'react-router/dom'
import router from './router.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
