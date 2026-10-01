import { getSettings, Settings } from '../../models/Settings.js'

// Seed step: the fixed city list (O-03, U-04) and TEST values for commission,
// GST and the platform company (database.md 5.4: bookings need them).
// The TEST values are only filled where the setting is still empty, so values the
// admin entered are never overwritten. Replace them after asking a CA (BR-20).

// `state` = the GST state of theatres in that city (11.3: CGST + SGST of this state)
export const CITIES = [
  { code: 'hyderabad', name: 'Hyderabad', state: 'Telangana' },
  { code: 'chennai', name: 'Chennai', state: 'Tamil Nadu' },
  { code: 'bengaluru', name: 'Bengaluru', state: 'Karnataka' },
  { code: 'mumbai', name: 'Mumbai', state: 'Maharashtra' },
  { code: 'pune', name: 'Pune', state: 'Maharashtra' },
  { code: 'delhi', name: 'Delhi', state: 'Delhi' },
  { code: 'kolkata', name: 'Kolkata', state: 'West Bengal' },
  { code: 'kochi', name: 'Kochi', state: 'Kerala' },
  { code: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat' },
  { code: 'jaipur', name: 'Jaipur', state: 'Rajasthan' },
]

// TEST values: made-up codes and a sample company, so nobody takes them as real
export const TEST_VALUES = {
  commissionPercent: 10,
  'gst.ticketPercent': 18,
  'gst.foodPercent': 5,
  'gst.convenienceFeePercent': 18,
  'gst.hsnSac.ticket': 'TEST-TICKET',
  'gst.hsnSac.food': 'TEST-FOOD',
  'gst.hsnSac.convenienceFee': 'TEST-FEE',
  'platform.companyName': 'Talkies Sample Pvt Ltd (TEST)',
  'platform.gstin': '36AABCT0000A1Z5',
  'platform.address': 'Sample address, Hyderabad, Telangana 500001 (TEST)',
}

const valueAt = (doc, path) => path.split('.').reduce((v, key) => v?.[key], doc)

export default {
  name: 'settings',
  async run() {
    const current = (await getSettings()).toObject()
    const fill = Object.fromEntries(Object.entries(TEST_VALUES).filter(([path]) => valueAt(current, path) == null))

    await Settings.updateOne({ _id: 'platform' }, { $set: { cities: CITIES, ...fill } })

    const lines = [`Settings: ${CITIES.length} cities`]
    if (Object.keys(fill).length > 0) {
      lines.push(`Settings: TEST values for commission / GST / platform company (${Object.keys(fill).length} fields). Replace them after asking a CA.`)
    }
    return lines
  },
}
