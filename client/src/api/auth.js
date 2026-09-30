import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore.js'
import { apiFetch } from './client.js'

// /api/auth calls (docs/api.md Section 3)

// U-01
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

// U-02
export function useLogin() {
  return useMutation({
    mutationFn: (body) => apiFetch('/auth/login', { method: 'POST', body }),
    onSuccess: (data) => useAuthStore.getState().setSession(data),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch('/auth/logout', { method: 'POST' }),
    // Log out on this device even if the server could not be reached
    onSettled: () => {
      useAuthStore.getState().clearSession()
      queryClient.clear() // forget data of the old user
    },
  })
}
