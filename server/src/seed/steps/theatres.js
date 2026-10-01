import { Theatre } from '../../models/Theatre.js'
import { User } from '../../models/User.js'
import { SAMPLE } from '../sample.js'
import { SEED_LOGINS } from './users.js'

// Seed step: 6 made-up sample theatres for the sample owner (15.5): 2 each in
// Hyderabad, Chennai and Bengaluru. Seeded as APPROVED, so screens, shows and
// browsing have data. The sample Gate Staff is linked to the 2 Hyderabad theatres.
// GSTINs are made up, but start with the right state code (Telangana 36,
// Tamil Nadu 33, Karnataka 29). Upsert by owner + name, so the seed can run again.

const THEATRES = [
  { name: 'Chandni Talkies (Sample)', cityCode: 'hyderabad', address: '12 Station Road, Secunderabad, Hyderabad 500003', gstin: '36AABCS1234A1Z5', wheelchairAccess: true, parking: true },
  { name: 'Golconda Picture Palace (Sample)', cityCode: 'hyderabad', address: '45 Fort Road, Golconda, Hyderabad 500008', gstin: '36AABCR5678B1Z2', wheelchairAccess: false, parking: true },
  { name: 'Marina Talkies (Sample)', cityCode: 'chennai', address: '7 Beach Road, Mylapore, Chennai 600004', gstin: '33AABCM1111C1Z9', wheelchairAccess: true, parking: false },
  { name: 'Kaveri Cinema Hall (Sample)', cityCode: 'chennai', address: '88 Mount Road, Teynampet, Chennai 600018', gstin: '33AABCK2222D1Z8', wheelchairAccess: false, parking: false },
  { name: 'Lalbagh Talkies (Sample)', cityCode: 'bengaluru', address: '3 Lalbagh Main Road, Basavanagudi, Bengaluru 560004', gstin: '29AABCB3333E1Z7', wheelchairAccess: true, parking: true },
  { name: 'Majestic Picture House (Sample)', cityCode: 'bengaluru', address: '21 Kempegowda Road, Gandhinagar, Bengaluru 560009', gstin: '29AABCL4444F1Z6', wheelchairAccess: false, parking: true },
]

export default {
  name: 'theatres',
  async run() {
    const [owner, admin, staff] = await Promise.all(
      [SEED_LOGINS.owner, SEED_LOGINS.admin, SEED_LOGINS.staff].map((email) => User.findOne({ email })),
    )

    const saved = []
    for (const t of THEATRES) {
      saved.push(
        await Theatre.findOneAndUpdate(
          { ownerId: owner._id, name: t.name },
          {
            $set: {
              ownerId: owner._id,
              name: t.name,
              cityCode: t.cityCode,
              address: t.address,
              gstin: t.gstin,
              amenities: { wheelchairAccess: t.wheelchairAccess, parking: t.parking },
              status: 'approved',
              decidedBy: admin._id,
              decidedAt: new Date(),
              ...SAMPLE,
            },
          },
          { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
        ),
      )
    }

    // ROLE-05: the sample staff scans for the 2 Hyderabad theatres
    const hyderabad = saved.filter((t) => t.cityCode === 'hyderabad').map((t) => t._id)
    await User.updateOne({ _id: staff._id }, { $set: { 'staff.theatreIds': hyderabad } })

    return [`Theatres: ${saved.length} approved sample theatres (2 each in Hyderabad, Chennai, Bengaluru)`, 'Gate Staff: linked to the 2 Hyderabad theatres']
  },
}
