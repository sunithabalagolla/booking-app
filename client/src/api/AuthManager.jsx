import { useEffect, useRef } from 'react'
import { restoreSession } from './client.js'

// On app start: log the user in again with the refresh cookie (U-02).
// Renders nothing.
export default function AuthManager() {
  const started = useRef(false)

  useEffect(() => {
    // Only once (React StrictMode runs effects twice in development)
    if (started.current) return
    started.current = true
    restoreSession()
  }, [])

  return null
}
