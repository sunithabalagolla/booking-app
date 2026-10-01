import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { AuthToken } from '../src/models/AuthToken.js'
import { User } from '../src/models/User.js'
import { assertUploadConfig, detectImageType } from '../src/services/upload/index.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// SEC-11 / NF-08 uploads. No Cloudinary keys in tests, so files go to the
// local test folder (UPLOADS_DIR in setupEnv.js).

// The first bytes of each image type (enough for the type check)
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)])
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)])
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(20)])

const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD })).body.accessToken
const upload = (token, { file = PNG, name = 'poster.png', kind = 'poster' } = {}) => {
  const req = request(app).post('/api/uploads').field('kind', kind).attach('file', file, name)
  return token ? req.set('Authorization', `Bearer ${token}`) : req
}

let adminToken
beforeAll(async () => {
  await connectTestDB()
  await Promise.all([User.init(), AuthToken.init()])
})
beforeEach(async () => {
  await clearTestDB()
  resetRateLimits()
  await createUser({ email: 'admin@example.com', role: 'admin' })
  adminToken = await login('admin@example.com')
})
afterAll(closeTestDB)

describe('detectImageType (SEC-11: from the content, not the name)', () => {
  it('knows jpg, png and webp; nothing else', () => {
    expect(detectImageType(JPG)).toBe('jpg')
    expect(detectImageType(PNG)).toBe('png')
    expect(detectImageType(WEBP)).toBe('webp')
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull()
    expect(detectImageType(Buffer.from('GIF89a'))).toBeNull()
  })
})

describe('POST /api/uploads', () => {
  it('saves an image (local folder without Cloudinary keys) and the link works', async () => {
    const res = await upload(adminToken)
    expect(res.status).toBe(201)
    expect(res.body.url).toMatch(/^\/api\/uploads\/files\/poster-[0-9a-f]{24}\.png$/)

    const file = await request(app).get(res.body.url)
    expect(file.status).toBe(200)
    expect(file.headers['content-type']).toMatch(/image\/png/)
  })

  it('uses the real type for the file name, not the uploaded name', async () => {
    const res = await upload(adminToken, { file: JPG, name: 'photo.png' })
    expect(res.body.url).toMatch(/\.jpg$/)
  })

  it('refuses a file that is not jpg / png / webp, even with an image name', async () => {
    const res = await upload(adminToken, { file: Buffer.from('<script>alert(1)</script>'), name: 'evil.png' })
    expect(res.status).toBe(400)
    expect(res.body.error.details.file).toBe('wrong_type')
  })

  it('refuses a file over 2 MB', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)])
    const res = await upload(adminToken, { file: big })
    expect(res.status).toBe(400)
    expect(res.body.error.details.file).toBe('too_big')
  })

  it('refuses a missing file and an unknown kind', async () => {
    const noFile = await request(app).post('/api/uploads').set('Authorization', `Bearer ${adminToken}`).field('kind', 'poster')
    expect(noFile.status).toBe(400)
    expect((await upload(adminToken, { kind: 'avatar' })).status).toBe(400)
  })

  it('only approved owners and admins (ROLE-01, ROLE-03)', async () => {
    await createUser({ email: 'owner@example.com', role: 'owner', phone: '9876543210', owner: { businessName: 'B', approvalStatus: 'approved' } })
    await createUser({ email: 'pending@example.com', role: 'owner', phone: '9876543211', owner: { businessName: 'P', approvalStatus: 'pending' } })
    await createUser({ email: 'user@example.com', role: 'user' })

    expect((await upload(await login('owner@example.com'), { kind: 'theatre' })).status).toBe(201)
    expect((await upload(await login('pending@example.com'))).body.error.code).toBe('OWNER_NOT_APPROVED')
    expect((await upload(await login('user@example.com'))).status).toBe(403)
    expect((await upload(null)).status).toBe(401)
  })

  it('a missing local file is a clean 404, not a 500', async () => {
    const res = await request(app).get('/api/uploads/files/nothing-here.png')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})

describe('assertUploadConfig', () => {
  const nodeEnv = process.env.NODE_ENV
  afterEach(() => {
    process.env.NODE_ENV = nodeEnv
  })

  it('production without Cloudinary keys refuses to start', () => {
    process.env.NODE_ENV = 'production'
    expect(() => assertUploadConfig()).toThrow(/Cloudinary keys are missing/)
  })

  it('development without keys is fine (local folder)', () => {
    process.env.NODE_ENV = 'development'
    expect(() => assertUploadConfig()).not.toThrow()
  })
})
