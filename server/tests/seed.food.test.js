import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import app from '../src/app.js'
import { FoodItem } from '../src/models/FoodItem.js'
import { Theatre } from '../src/models/Theatre.js'
import { User } from '../src/models/User.js'
import foodStep, { FOOD } from '../src/seed/steps/food.js'
import settingsStep from '../src/seed/steps/settings.js'
import theatresStep from '../src/seed/steps/theatres.js'
import usersStep from '../src/seed/steps/users.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'

beforeAll(async () => {
  process.env.SEED_PASSWORD = 'test-only-seed-pass1'
  await connectTestDB()
  await Promise.all([User.init(), Theatre.init(), FoodItem.init()])
})
beforeEach(async () => {
  await clearTestDB()
  await settingsStep.run()
  await usersStep.run()
  await theatresStep.run()
})
afterAll(closeTestDB)

describe('seed step: food (15.5)', () => {
  it('makes 6 items per sample theatre with veg, non-veg and a combo; running again adds nothing', async () => {
    await foodStep.run()
    await foodStep.run()
    expect(await FoodItem.countDocuments({ isSample: true })).toBe(36)

    const theatre = await Theatre.findOne()
    const items = await FoodItem.find({ theatreId: theatre._id })
    expect(items).toHaveLength(FOOD.length)
    expect(items.some((f) => !f.isVeg)).toBe(true)
    expect(items.some((f) => f.isCombo)).toBe(true)
    for (const f of items) {
      expect(String(f.ownerId)).toBe(String(theatre.ownerId))
      expect(f.pricePaise % 100).toBe(0) // whole rupees
    }
  })

  it('the pictures work', async () => {
    await foodStep.run()
    const item = await FoodItem.findOne({ name: 'Chicken Puff' })
    const picture = await request(app).get(item.photoUrl)
    expect(picture.status).toBe(200)
    expect(picture.headers['content-type']).toMatch(/image\/svg\+xml/)
  })
})
