import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { v2 as cloudinary } from 'cloudinary'
import { LOCAL_FILES_PATH, POSTER_MAX_WIDTH_PX, uploadsDir } from '../../config/uploads.js'

// Saves images (NF-08). The database keeps only the URL.
// - Cloudinary keys in .env → Cloudinary (posters resized to max 800 px wide there).
// - No keys, development → a local folder (no resizing), like emails go to the
//   console without a Postmark key.
// - No keys, production → the server refuses to start (assertUploadConfig).

export function hasCloudinaryKeys() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
}

// Called once at server start
export function assertUploadConfig() {
  if (process.env.NODE_ENV === 'production' && !hasCloudinaryKeys()) {
    throw new Error('Cloudinary keys are missing (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET). Set them in .env.')
  }
}

// SEC-11: the real file type from the first bytes, not from the name
export function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg'
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  return null
}

function uploadToCloudinary(buffer, { kind, name }) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  })
  const options = {
    folder: `talkies/${kind}`,
    resource_type: 'image',
    ...(name ? { public_id: name, overwrite: true } : {}),
    // NF-08: posters max 800 px wide (never made bigger)
    ...(kind === 'poster' ? { transformation: [{ width: POSTER_MAX_WIDTH_PX, crop: 'limit' }] } : {}),
  }
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(options, (error, result) => (error ? reject(error) : resolve(result.secure_url)))
      .end(buffer)
  })
}

async function saveLocally(buffer, { kind, ext, name }) {
  const fileName = `${kind}-${name ?? randomBytes(12).toString('hex')}.${ext}`
  await mkdir(uploadsDir(), { recursive: true })
  await writeFile(path.join(uploadsDir(), fileName), buffer)
  return `${LOCAL_FILES_PATH}/${fileName}`
}

// Returns the URL to save. `name` (optional) gives a fixed file name, so the seed
// can run again without making new copies.
export async function storeImage(buffer, { kind, ext, name }) {
  if (hasCloudinaryKeys()) return uploadToCloudinary(buffer, { kind, name })
  assertUploadConfig()
  return saveLocally(buffer, { kind, ext, name })
}
