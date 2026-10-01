import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Image upload settings (SEC-11, NF-08). Max size and poster width are in the
// settings collection (A-05: uploadMaxMb, posterMaxWidthPx).
export const UPLOAD_KINDS = ['poster', 'cast', 'theatre', 'food']

// Development only (no Cloudinary keys): files are saved here and served at
// /api/uploads/files/<name>. UPLOADS_DIR can change it (tests use a temp folder).
const defaultDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads')
export function uploadsDir() {
  return process.env.UPLOADS_DIR || defaultDir
}

export const LOCAL_FILES_PATH = '/api/uploads/files'
