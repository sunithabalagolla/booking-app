import { hasLoginHint, useAuthStore } from '../store/authStore.js'

// Small fetch helper for all API calls.
// Errors from the server come in one shape (docs/api.md 1.5); they are thrown as ApiError.

export class ApiError extends Error {
  constructor({ status, code, message, details, requestId }) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }
}

const SESSION_EXPIRED_MESSAGE = 'Interval over! Please log in again to continue the show.'

// One HTTP call. Adds the access token when there is one.
// blob: true = a file answer (PDF download, U-17); errors are still JSON.
async function request(path, { method = 'GET', body, blob = false } = {}) {
  const token = useAuthStore.getState().accessToken
  const headers = {}
  // FormData (image uploads): the browser sets the multipart Content-Type itself
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  if (body && !isForm) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
      credentials: 'include', // sends the refresh cookie to /api/auth
    })
  } catch {
    // No internet (UI-36 message)
    throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Power cut! Waiting for the generator… Please check your internet and try again.' })
  }

  if (blob && res.ok) return res.blob()
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = data.error ?? {}
    throw new ApiError({
      status: res.status,
      code: error.code ?? 'SERVER_ERROR',
      message: error.message ?? 'Sorry for the interruption. Our projector operator is fixing the reel. Please try again.',
      details: error.details,
      requestId: error.requestId,
    })
  }
  return data
}

// Gets a new access token with the refresh cookie (U-02).
// Many calls at the same time share ONE refresh, because every refresh
// token works only once (rotation).
// Returns null when it worked, or the ApiError when it did not.
let refreshing = null
export function refreshSession() {
  refreshing ??= request('/auth/refresh', { method: 'POST' })
    .then((data) => {
      useAuthStore.getState().setSession(data)
      return null
    })
    .catch((error) => error)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

// App start: log in again silently if the refresh cookie is still good.
// Only when this browser was logged in before (hint); a guest makes no call.
export async function restoreSession() {
  if (!hasLoginHint()) {
    useAuthStore.getState().clearSession()
    return
  }
  const error = await refreshSession()
  if (error) useAuthStore.getState().clearSession()
}

// Every API call goes through here. When the access token has expired, it
// refreshes once and repeats the call. If that fails, the user is logged out
// with the UI-36 "Interval over!" message.
export async function apiFetch(path, options = {}) {
  try {
    return await request(path, options)
  } catch (error) {
    if (error.code !== 'TOKEN_EXPIRED') throw error

    const refreshError = await refreshSession()
    if (!refreshError) return request(path, options)

    if (refreshError.code !== 'NETWORK_ERROR') {
      useAuthStore.getState().clearSession({ expired: true })
      throw new ApiError({ status: 401, code: 'SESSION_EXPIRED', message: SESSION_EXPIRED_MESSAGE })
    }
    throw refreshError
  }
}
