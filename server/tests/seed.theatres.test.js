import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { GST_STATE_CODES, gstinMatchesState } from '../src/config/gstStates.js'
import { Settings } from '../src/models/Settings.js'
import { Theatre } from '../src/models/Theatre.js'
import { User } from '../src/models/User.js'
import settingsStep, { CITIES } from '../src/seed/steps/settings.js'
import theatresStep from '../src/seed/steps/theatres.js'
import usersStep, { SEED_LOGINS } from '../src/seed/steps/users.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'

beforeAll(async () => {
  process.env.SEED_PASSWORD = 'test-only-seed-pass1'
  await connectTestDB()
  await Promise.all([User.init(), Theatre.init()])
})
beforeEach(async () => {
  await clearTestDB()
  await settingsStep.run()
  await usersStep.run()
})
afterAll(closeTestDB)

describe('seed step: theatres (15.5)', () => {
  it('makes 6 approved sample theatres, 2 per city, with GSTINs of the right state', async () => {
    await theatresStep.run()
    const owner = await User.findOne({ email: SEED_LOGINS.owner })
    const theatres = await Theatre.find({ ownerId: owner._id, isSample: true, status: 'approved' })
    expect(theatres).toHaveLength(6)

    const perCity = theatres.reduce((count, t) => ({ ...count, [t.cityCode]: (count[t.cityCode] ?? 0) + 1 }), {})
    expect(perCity).toEqual({ hyderabad: 2, chennai: 2, bengaluru: 2 })

    const { cities } = await Settings.findById('platform')
    for (const t of theatres) expect(gstinMatchesState(t.gstin, cities.find((c) => c.code === t.cityCode).state), t.name).toBe(true)
  })

  it('links the sample Gate Staff to the 2 Hyderabad theatres; a second seed keeps them', async () => {
    await theatresStep.run()
    await usersStep.run() // running the whole seed again must not unlink the staff
    await theatresStep.run()

    const staff = await User.findOne({ email: SEED_LOGINS.staff })
    const hyderabad = await Theatre.find({ cityCode: 'hyderabad' })
    expect(staff.staff.theatreIds.map(String).sort()).toEqual(hyderabad.map((t) => String(t._id)).sort())
    expect(await Theatre.countDocuments()).toBe(6)
  })

  it('every city in the list has a GST state code', () => {
    for (const city of CITIES) expect(GST_STATE_CODES[city.state], city.name).toMatch(/^\d{2}$/)
  })
})
