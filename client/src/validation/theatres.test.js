import { describe, expect, it } from 'vitest'
import { fieldErrors } from './auth.js'
import { EMPTY_THEATRE, theatreFormSchema, theatreToForm } from './theatres.js'

const cities = [
  { code: 'hyderabad', name: 'Hyderabad', state: 'Telangana' },
  { code: 'chennai', name: 'Chennai', state: 'Tamil Nadu' },
]
const schema = theatreFormSchema(cities)
const good = { ...EMPTY_THEATRE, name: 'Chandni Talkies', cityCode: 'hyderabad', address: '12 Station Road, Hyderabad', gstin: '36aabcs1234a1z5' }

describe('theatreFormSchema (O-03)', () => {
  it('accepts a good theatre and makes the GSTIN upper case', () => {
    expect(schema.parse(good).gstin).toBe('36AABCS1234A1Z5')
  })

  it('gives a message for each empty required field', () => {
    expect(Object.keys(fieldErrors(schema.safeParse(EMPTY_THEATRE).error)).sort()).toEqual(['address', 'cityCode', 'gstin', 'name'])
  })

  it('refuses a GSTIN of another state, with the needed code', () => {
    const errors = fieldErrors(schema.safeParse({ ...good, cityCode: 'chennai' }).error)
    expect(errors.gstin).toMatch(/starts with 33/)
  })

  it('refuses an http map link and more than 6 photos', () => {
    const errors = fieldErrors(schema.safeParse({ ...good, mapLink: 'http://x', photos: Array(7).fill('/p.png') }).error)
    expect(Object.keys(errors).sort()).toEqual(['mapLink', 'photos'])
  })

  it('turns an API theatre into form values', () => {
    const form = theatreToForm({ ...good, city: { code: 'hyderabad' }, mapLink: null, photos: [], amenities: { wheelchairAccess: true, parking: false } })
    expect(form).toMatchObject({ cityCode: 'hyderabad', mapLink: '', amenities: { wheelchairAccess: true, parking: false } })
  })
})
