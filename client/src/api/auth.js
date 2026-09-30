import { useMutation } from '@tanstack/react-query'
import { apiFetch } from './client.js'

// /api/auth calls (docs/api.md Section 3)

export function useSignup() {
  return useMutation({
    mutationFn: (body) => apiFetch('/auth/signup', { method: 'POST', body }),
  })
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token) => apiFetch('/auth/verify-email', { method: 'POST', body: { token } }),
  })
}

export function useResendVerify() {
  return useMutation({
    mutationFn: (email) => apiFetch('/auth/resend-verify', { method: 'POST', body: { email } }),
  })
}
