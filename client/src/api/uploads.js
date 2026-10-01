import { apiFetch } from './client.js'

// SEC-11 image upload (api.md Section 11). The server checks again.
export const UPLOAD_MAX_MB = 2
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Quick check before sending, so the user sees the problem at once.
// Returns an error message or null.
export function checkImageFile(file) {
  if (!IMAGE_TYPES.includes(file.type)) return 'Only jpg, png or webp images are allowed.'
  if (file.size > UPLOAD_MAX_MB * 1024 * 1024) return `The image is too big. Max ${UPLOAD_MAX_MB} MB.`
  return null
}

// kind: 'poster' · 'cast' · 'theatre' · 'food'. Returns the saved image URL.
export async function uploadImage(file, kind) {
  const form = new FormData()
  form.append('kind', kind)
  form.append('file', file)
  const { url } = await apiFetch('/uploads', { method: 'POST', body: form })
  return url
}
