import { Settings } from '../../src/models/Settings.js'

// Settings for tests that hold seats: the defaults + test GST rates (BR-20 has no
// default, and a hold needs them: 503 PRICES_NOT_READY otherwise)
export const TEST_GST = { ticketPercent: 18, foodPercent: 5, convenienceFeePercent: 18, hsnSac: { ticket: 'TEST-TICKET', food: 'TEST-FOOD', convenienceFee: 'TEST-FEE' } }

export const createTestSettings = (fields = {}) => Settings.create({ gst: TEST_GST, commissionPercent: 10, ...fields })
