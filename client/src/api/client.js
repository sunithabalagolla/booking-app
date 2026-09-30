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

export async function apiFetch(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    })
  } catch {
    // No internet (UI-36 message)
    throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Power cut! Waiting for the generator… Please check your internet and try again.' })
  }

  const data = await res.json().catch(() => ({}))
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
