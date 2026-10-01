import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Image upload settings (SEC-11, NF-08). Fixed here for now; they move to the
// settings collection with A-05 (uploadMaxMb, posterMaxWidthPx in database.md).
export const UPLOAD_MAX_MB = 2
export const POSTER_MAX_WIDTH_PX = 800
export const UPLOAD_KINDS = ['poster', 'cast', 'theatre', 'food']

// Development only (no Cloudinary keys): files are saved here and served at
// /api/uploads/files/<name>. UPLOADS_DIR can change it (tests use a temp folder).
const defaultDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads')
export function uploadsDir() {
  return process.env.UPLOADS_DIR || defaultDir
}

export const LOCAL_FILES_PATH = '/api/uploads/files'
