import express, { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { UPLOAD_KINDS, UPLOAD_MAX_MB, uploadsDir } from '../config/uploads.js'
import { requireAuth } from '../middleware/auth.js'
import { requireApprovedOwner, requireRole } from '../middleware/role.js'
import { validate } from '../middleware/validate.js'
import { detectImageType, storeImage } from '../services/upload/index.js'
import { AppError } from '../utils/AppError.js'

// /api/uploads (api.md Section 11, SEC-11, NF-08)
const router = Router()

// Keep the file in memory (max 2 MB), check it, then send it to Cloudinary / the folder
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_MB * 1024 * 1024, files: 1 },
}).single('file')

function receiveFile(req, res, next) {
  upload(req, res, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(400, 'VALIDATION_ERROR', `The image is too big. Max ${UPLOAD_MAX_MB} MB.`, { file: 'too_big' }))
    }
    if (error) return next(new AppError(400, 'VALIDATION_ERROR', 'Please send one image in the "file" field.'))
    next()
  })
}

const uploadSchema = z.object({ kind: z.enum(UPLOAD_KINDS, { error: 'Unknown image kind.' }) })

// POST /api/uploads: Owner (approved) or Admin
router.post('/', requireAuth, requireRole('owner', 'admin'), requireApprovedOwner, receiveFile, validate({ body: uploadSchema }), async (req, res) => {
  if (!req.file) throw new AppError(400, 'VALIDATION_ERROR', 'Please choose an image.', { file: 'missing' })

  const ext = detectImageType(req.file.buffer)
  if (!ext) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Only jpg, png or webp images are allowed.', { file: 'wrong_type' })
  }

  const url = await storeImage(req.file.buffer, { kind: req.valid.body.kind, ext })
  res.status(201).json({ url })
})

// Development only: files saved without Cloudinary. Anyone may view them (like Cloudinary links).
router.use('/files', express.static(uploadsDir(), { fallthrough: false, index: false, dotfiles: 'deny' }))

export default router
