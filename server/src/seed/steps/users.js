import bcrypt from 'bcrypt'
import { BCRYPT_ROUNDS } from '../../config/auth.js'
import { User } from '../../models/User.js'
import { getSeedPassword, SAMPLE } from '../sample.js'

// Seed step: one test login for each role (15.5). All use SEED_PASSWORD from .env.
// Upsert by email, so running the seed again does not fail; it only resets these logins.
export const SEED_LOGINS = {
  admin: 'admin@talkies.test',
  user: 'user@talkies.test',
  owner: 'owner@talkies.test',
  staff: 'staff@talkies.test',
}

async function upsertUser(email, fields) {
  return User.findOneAndUpdate(
    { email },
    { $set: { email, emailVerified: true, status: 'active', ...fields, ...SAMPLE } },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  )
}

export default {
  name: 'users',
  async run() {
    const passwordHash = await bcrypt.hash(getSeedPassword(), BCRYPT_ROUNDS)

    // ROLE-06: admins only come from the seed or another admin
    const admin = await upsertUser(SEED_LOGINS.admin, { name: 'Sample Admin', role: 'admin', passwordHash })
    await upsertUser(SEED_LOGINS.user, { name: 'Sample User', role: 'user', passwordHash })
    const owner = await upsertUser(SEED_LOGINS.owner, {
      name: 'Sample Owner',
      role: 'owner',
      phone: '9876543210',
      passwordHash,
      owner: { businessName: 'Sample Talkies Pvt Ltd', approvalStatus: 'approved', decidedBy: admin._id, decidedAt: new Date() },
    })
    // ROLE-05 needs theatres; they come with the theatres seed step (Phase 2). Until then: none.
    await upsertUser(SEED_LOGINS.staff, {
      name: 'Sample Gate Staff',
      role: 'staff',
      passwordHash,
      staff: { ownerId: owner._id, theatreIds: [] },
    })

    return [
      'Test logins (password = SEED_PASSWORD in .env):',
      `  User:       ${SEED_LOGINS.user}`,
      `  Owner:      ${SEED_LOGINS.owner} (approved)`,
      `  Gate Staff: ${SEED_LOGINS.staff} (no theatres yet)`,
      `  Admin:      ${SEED_LOGINS.admin}`,
    ]
  },
}
