import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Coupon } from '../src/models/Coupon.js'
import { User } from '../src/models/User.js'
import couponsStep from '../src/seed/steps/coupons.js'
import settingsStep from '../src/seed/steps/settings.js'
import usersStep from '../src/seed/steps/users.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'

beforeAll(async () => {
  process.env.SEED_PASSWORD = 'test-only-seed-pass1'
  await connectTestDB()
  await Promise.all([User.init(), Coupon.init()])
})
beforeEach(async () => {
  await clearTestDB()
  await settingsStep.run()
  await usersStep.run()
})
afterAll(closeTestDB)

describe('seed step: coupons (15.5)', () => {
  it('makes TALKIES20 and FLAT50, valid now, by the sample admin; running again adds nothing and keeps usedCount', async () => {
    await couponsStep.run()
    await Coupon.updateOne({ code: 'FLAT50' }, { usedCount: 3 })
    await couponsStep.run()

    const coupons = await Coupon.find().sort({ code: 1 })
    expect(coupons.map((c) => c.code)).toEqual(['FLAT50', 'TALKIES20'])
    const admin = await User.findOne({ role: 'admin' })
    const now = new Date()
    for (const c of coupons) {
      expect(c.isSample).toBe(true)
      expect(String(c.createdBy)).toBe(String(admin._id))
      expect(c.startAt < now && c.endAt > now).toBe(true)
    }
    expect(coupons[0]).toMatchObject({ discountType: 'flat', value: 5000, perUserLimit: 1, usedCount: 3, isPublic: false }) // secret code
    expect(coupons[1]).toMatchObject({ discountType: 'percent', value: 20, maxDiscountPaise: 10000, minAmountPaise: 20000, isPublic: true }) // in Available offers
  })
})
