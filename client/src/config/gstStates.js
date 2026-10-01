// GST state codes: the first 2 digits of a GSTIN (O-03 check, decided 2026-10-01).
// A theatre's GSTIN must start with the code of its city's state (settings.cities).
// Same list as the server (server/src/config/gstStates.js); gstStates.test.js checks they match.
export const GST_STATE_CODES = {
  'Jammu and Kashmir': '01',
  'Himachal Pradesh': '02',
  Punjab: '03',
  Chandigarh: '04',
  Uttarakhand: '05',
  Haryana: '06',
  Delhi: '07',
  Rajasthan: '08',
  'Uttar Pradesh': '09',
  Bihar: '10',
  Assam: '18',
  'West Bengal': '19',
  Jharkhand: '20',
  Odisha: '21',
  Chhattisgarh: '22',
  'Madhya Pradesh': '23',
  Gujarat: '24',
  Maharashtra: '27',
  Karnataka: '29',
  Goa: '30',
  Kerala: '32',
  'Tamil Nadu': '33',
  Puducherry: '34',
  Telangana: '36',
  'Andhra Pradesh': '37',
}

// Does this GSTIN belong to that state?
export function gstinMatchesState(gstin, state) {
  return GST_STATE_CODES[state] !== undefined && gstin.slice(0, 2) === GST_STATE_CODES[state]
}
