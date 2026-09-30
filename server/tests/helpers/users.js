import bcrypt from 'bcrypt'
import { User } from '../../src/models/User.js'

export const TEST_PASSWORD = 'matinee123'

// Low cost only in tests, so tests stay fast
let testHash
const hashOnce = async () => (testHash ??= await bcrypt.hash(TEST_PASSWORD, 4))

// Makes a user straight in the database (verified and active unless told otherwise)
export async function createUser(fields = {}) {
  return User.create({
    name: 'Test User',
    email: 'test.user@example.com',
    role: 'user',
    emailVerified: true,
    status: 'active',
    passwordHash: await hashOnce(),
    ...fields,
  })
}
