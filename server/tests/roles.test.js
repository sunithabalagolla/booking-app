import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import app from '../src/app.js'
import { resetRateLimits } from '../src/config/rateLimits.js'
import { findOwned, ownedFilter } from '../src/middleware/ownership.js'
import { AuthToken } from '../src/models/AuthToken.js'
import { User } from '../src/models/User.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'
import { createUser, TEST_PASSWORD } from './helpers/users.js'

// T-01 part: role checks (ROLE-01, ROLE-03) and ownership (ROLE-02)

const { ObjectId } = mongoose.Types

// One login for each kind of person
async function createAll() {
  const owner = await createUser({
    email: 'owner@example.com',
    role: 'owner',
    phone: '9876543210',
    owner: { businessName: 'Ravi Talkies', approvalStatus: 'approved' },
  })
  const theatreId = new ObjectId()
  await createUser({ email: 'user@example.com', role: 'user' })
  await createUser({
    email: 'pending@example.com',
    role: 'owner',
    phone: '9876543211',
    owner: { businessName: 'New Talkies', approvalStatus: 'pending' },
  })
  await createUser({
    email: 'rejected@example.com',
    role: 'owner',
    phone: '9876543212',
    owner: { businessName: 'Old Talkies', approvalStatus: 'rejected', rejectReason: 'No GSTIN' },
  })
  await createUser({ email: 'staff@example.com', role: 'staff', staff: { ownerId: owner._id, theatreIds: [theatreId] } })
  await createUser({ email: 'admin@example.com', role: 'admin' })
}

const tokens = {}
async function tokenFor(name) {
  tokens[name] ??= (await request(app).post('/api/auth/login').send({ email: `${name}@example.com`, password: TEST_PASSWORD })).body.accessToken
  return tokens[name]
}
const call = async (path, name) => {
  const req = request(app).get(path)
  return name ? req.set('Authorization', `Bearer ${await tokenFor(name)}`) : req
}

beforeAll(async () => {
  await connectTestDB()
  await User.init()
  await AuthToken.init()
  await clearTestDB()
  await createAll()
})
beforeEach(() => resetRateLimits())
afterAll(closeTestDB)

// The groups have no endpoints yet: passing the checks ends in 404 NOT_FOUND
const PASSED = 404

describe('ROLE-01 role check per route group', () => {
  const table = [
    // [path, who, expected status, expected error code]
    ['/api/owner/x', 'owner', PASSED, 'NOT_FOUND'],
    ['/api/owner/x', 'user', 403, 'FORBIDDEN'],
    ['/api/owner/x', 'staff', 403, 'FORBIDDEN'],
    ['/api/owner/x', 'admin', 403, 'FORBIDDEN'],
    ['/api/staff/x', 'staff', PASSED, 'NOT_FOUND'],
    ['/api/staff/x', 'user', 403, 'FORBIDDEN'],
    ['/api/staff/x', 'owner', 403, 'FORBIDDEN'],
    ['/api/staff/x', 'admin', 403, 'FORBIDDEN'],
    ['/api/admin/x', 'admin', PASSED, 'NOT_FOUND'],
    ['/api/admin/x', 'user', 403, 'FORBIDDEN'],
    ['/api/admin/x', 'owner', 403, 'FORBIDDEN'],
    ['/api/admin/x', 'staff', 403, 'FORBIDDEN'],
  ]

  it.each(table)('%s as %s → %i', async (path, who, status, code) => {
    const res = await call(path, who)
    expect(res.status).toBe(status)
    expect(res.body.error.code).toBe(code)
  })

  it.each(['/api/owner/x', '/api/staff/x', '/api/admin/x'])('%s without a login → 401', async (path) => {
    const res = await call(path)
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('UNAUTHORIZED')
  })
})

describe('ROLE-03 owners must be approved', () => {
  it.each(['pending', 'rejected'])('a %s owner gets 403 OWNER_NOT_APPROVED', async (who) => {
    const res = await call('/api/owner/theatres', who)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('OWNER_NOT_APPROVED')
  })
})

describe('ROLE-05 / ROLE-06 nobody can sign up as staff or admin', () => {
  it.each(['staff', 'admin'])('sign up with role %s makes a normal user / pending owner', async (role) => {
    const email = `new.${role}@example.com`
    await request(app).post('/api/auth/signup').send({ name: 'X', email, password: TEST_PASSWORD, role })
    const owner = `owner.${role}@example.com`
    await request(app)
      .post('/api/auth/owner-signup')
      .send({ name: 'X', email: owner, phone: '9876543299', businessName: 'B', password: TEST_PASSWORD, role })

    expect((await User.findOne({ email })).role).toBe('user')
    expect((await User.findOne({ email: owner })).role).toBe('owner')
  })
})

// ROLE-02: a small test-only collection with the usual owner fields
const Item = mongoose.model('RoleTestItem', new mongoose.Schema({ ownerId: ObjectId, theatreId: ObjectId, userId: ObjectId }))

describe('ROLE-02 ownership: findOwned / ownedFilter', () => {
  let owner, otherOwnerId, staff, user, admin, myItem, otherItem

  beforeAll(async () => {
    owner = await User.findOne({ email: 'owner@example.com' })
    staff = await User.findOne({ email: 'staff@example.com' })
    user = await User.findOne({ email: 'user@example.com' })
    admin = await User.findOne({ email: 'admin@example.com' })
    otherOwnerId = new ObjectId()
    myItem = await Item.create({ ownerId: owner._id, theatreId: staff.staff.theatreIds[0], userId: user._id })
    otherItem = await Item.create({ ownerId: otherOwnerId, theatreId: new ObjectId(), userId: new ObjectId() })
  })

  it('owner: own item found, another owner item → 404', async () => {
    expect(String((await findOwned(Item, myItem._id, owner))._id)).toBe(String(myItem._id))
    await expect(findOwned(Item, otherItem._id, owner)).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })

  it('staff: item of my theatre found, other theatre → 404', async () => {
    expect(await findOwned(Item, myItem._id, staff)).toBeTruthy()
    await expect(findOwned(Item, otherItem._id, staff)).rejects.toMatchObject({ status: 404 })
  })

  it('user: own item found, someone else item → 404', async () => {
    expect(await findOwned(Item, myItem._id, user)).toBeTruthy()
    await expect(findOwned(Item, otherItem._id, user)).rejects.toMatchObject({ status: 404 })
  })

  it('admin: everything', async () => {
    expect(await findOwned(Item, otherItem._id, admin)).toBeTruthy()
  })

  it('a bad ID → 404, not a crash', async () => {
    await expect(findOwned(Item, 'not-an-id', owner)).rejects.toMatchObject({ status: 404 })
  })

  it("theatreField '_id' for the theatres collection itself", () => {
    expect(ownedFilter(staff, { theatreField: '_id' })).toEqual({ _id: { $in: staff.staff.theatreIds } })
  })

  it('a list with ownedFilter shows only own items', async () => {
    const mine = await Item.find(ownedFilter(owner))
    expect(mine.map((i) => String(i._id))).toEqual([String(myItem._id)])
  })
})
