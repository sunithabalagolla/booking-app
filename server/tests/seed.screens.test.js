import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Screen } from '../src/models/Screen.js'
import { Theatre } from '../src/models/Theatre.js'
import { User } from '../src/models/User.js'
import screensStep from '../src/seed/steps/screens.js'
import settingsStep from '../src/seed/steps/settings.js'
import theatresStep from '../src/seed/steps/theatres.js'
import usersStep from '../src/seed/steps/users.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'

beforeAll(async () => {
  process.env.SEED_PASSWORD = 'test-only-seed-pass1'
  await connectTestDB()
  await Promise.all([User.init(), Theatre.init(), Screen.init()])
})
beforeEach(async () => {
  await clearTestDB()
  await settingsStep.run()
  await usersStep.run()
  await theatresStep.run()
})
afterAll(closeTestDB)

describe('seed step: screens (15.5)', () => {
  it('makes 2 screens with seat layouts per sample theatre; running again adds nothing', async () => {
    await screensStep.run()
    await screensStep.run()
    expect(await Screen.countDocuments({ isSample: true })).toBe(12)

    for (const theatre of await Theatre.find()) {
      const screens = await Screen.find({ theatreId: theatre._id }).sort({ name: 1 })
      expect(screens.map((s) => s.name)).toEqual(['Screen 1', 'Screen 2'])
      // Wheelchair spaces only where the theatre has wheelchair access
      expect(screens[0].wheelchairFriendly, theatre.name).toBe(theatre.amenities.wheelchairAccess)
      for (const s of screens) {
        expect(String(s.ownerId)).toBe(String(theatre.ownerId))
        const ids = s.layout.grid.flatMap((r) => r.cells.filter((c) => c.type === 'seat').map((c) => c.seatId))
        expect(new Set(ids).size).toBe(s.seatCount.balcony + s.seatCount.first + s.seatCount.second)
      }
    }
  })

  it('Screen 1 has all 3 classes, Balcony at the back and row A in front', async () => {
    await screensStep.run()
    const screen = await Screen.findOne({ name: 'Screen 1' })
    expect(screen.seatCount.balcony).toBeGreaterThan(0)
    expect(screen.seatCount.first).toBeGreaterThan(0)
    expect(screen.seatCount.second).toBeGreaterThan(0)
    expect(screen.layout.grid[0].cells.find((c) => c.type === 'seat').seatClass).toBe('balcony')
    expect(screen.layout.grid.at(-1).label).toBe('A')
  })
})
