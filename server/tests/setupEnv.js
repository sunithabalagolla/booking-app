import os from 'node:os'
import path from 'node:path'

// Runs before every test file: test-only settings (never real secrets)
process.env.JWT_ACCESS_SECRET ??= 'test-only-access-secret-at-least-32-characters-long'
process.env.PAYMENT_SECRET ??= 'test-only-payment-secret-at-least-32-characters'
process.env.CLIENT_URL ??= 'http://localhost:5173'
delete process.env.POSTMARK_API_KEY // tests never send real emails
// Uploads: never Cloudinary in tests; local files go to a temp folder
delete process.env.CLOUDINARY_CLOUD_NAME
delete process.env.CLOUDINARY_API_KEY
delete process.env.CLOUDINARY_API_SECRET
process.env.UPLOADS_DIR ??= path.join(os.tmpdir(), 'talkies-test-uploads')
