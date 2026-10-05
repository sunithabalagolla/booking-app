import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import mongoose from 'mongoose'
import request from 'supertest'
import app from '../src/app.js'
import { Movie } from '../src/models/Movie.js'
import { Show } from '../src/models/Show.js'
import { Theatre } from '../src/models/Theatre.js'
import { istDateTime } from '../src/utils/showTime.js'
import { istDayToDate, istToday } from '../src/utils/time.js'
import { clearTestDB, closeTestDB, connectTestDB } from './helpers/db.js'

// U-09 GET /api/movies/:id/shows (first used by the Home banner "Today in [city]" chips)

const HOUR = 60 * 60 * 1000
const ownerId = new mongoose.Types.ObjectId()
const TOMORROW = istToday(1)

let movie, chandni, akash
const makeTheatre = (name, cityCode, status = 'approved') =>
  Theatre.create({ ownerId, name, cityCode, address: '1 Main Road, City', gstin: '36AABCS1234A1Z5', status, amenities: { wheelchairAccess: true, parking: false } })
// Raw show with the fields the list reads
const makeShow = (theatre, startAt, extra = {}) =>
  Show.collection.insertOne({
    movieId: movie._id,
    theatreId: theatre._id,
    cityCode: theatre.cityCode,
    startAt,
    endAt: new Date(startAt.getTime() + 2 * HOUR),
    label: 'matinee',
    language: 'Hindi',
    format: '2D',
    subtitles: false,
    wheelchairFriendly: false,
    tags: [],
    prices: [
      { seatClass: 'balcony', pricePaise: 25000 },
      { seatClass: 'second', pricePaise: 12000 },
    ],
    totalSeats: 100,
    bookedCount: 0,
    status: 'scheduled',
    ...extra,
  })
const list = (query, id = movie._id) => request(app).get(`/api/movies/${id}/shows?${query}`)

beforeAll(async () => {
  await connectTestDB()
  await Promise.all([Movie.init(), Show.init(), Theatre.init()])
})
beforeEach(async () => {
  await clearTestDB()
  movie = await Movie.create({
    title: 'Operation Monsoon',
    posterUrl: '/p.png',
    genres: ['Action'],
    languages: ['Hindi'],
    durationMinutes: 156,
    certificate: 'UA',
    releaseDate: istDayToDate(istToday(-5)),
    status: 'now_showing',
  })
  chandni = await makeTheatre('Chandni Talkies', 'hyderabad')
  akash = await makeTheatre('Akash Cinema', 'hyderabad')
})
afterAll(closeTestDB)

describe('GET /api/movies/:id/shows (U-09)', () => {
  it('shows of the day in the city, grouped by theatre A to Z, in time order', async () => {
    await makeShow(chandni, istDateTime(TOMORROW, '18:00'), { label: 'first' })
    await makeShow(chandni, istDateTime(TOMORROW, '13:00'), { bookedCount: 100 })
    await makeShow(akash, istDateTime(TOMORROW, '21:00'), { label: 'second', deal: { active: true, percent: 20 } })
    await makeShow(chandni, istDateTime(istToday(2), '13:00')) // another day
    await makeShow(await makeTheatre('Far Away', 'chennai'), istDateTime(TOMORROW, '13:00')) // another city
    await makeShow(await makeTheatre('Waiting', 'hyderabad', 'pending'), istDateTime(TOMORROW, '13:00')) // not approved
    await makeShow(chandni, istDateTime(TOMORROW, '15:00'), { status: 'cancelled' })

    const res = await list(`city=hyderabad&date=${TOMORROW}`)
    expect(res.status).toBe(200)
    expect(res.body.date).toBe(TOMORROW)
    expect(res.body.items.map((g) => g.theatre.name)).toEqual(['Akash Cinema', 'Chandni Talkies'])
    expect(res.body.items[1].shows.map((s) => s.startTime)).toEqual(['13:00', '18:00'])
    expect(res.body.items[1].shows[0]).toMatchObject({ label: 'matinee', housefull: true, minPricePaise: 12000, deal: { active: false, percent: null } })
    expect(res.body.items[0].shows[0]).toMatchObject({ startTime: '21:00', label: 'second', housefull: false, deal: { active: true, percent: 20 } })
    expect(res.body.items[0].theatre).toMatchObject({ address: '1 Main Road, City', amenities: { wheelchairAccess: true } })
  })

  it('today: shows that already started are left out', async () => {
    await makeShow(chandni, new Date(Date.now() - HOUR))
    await makeShow(chandni, new Date(Date.now() + HOUR))
    const res = await list(`city=hyderabad&date=${istToday()}`)
    const shows = res.body.items.flatMap((g) => g.shows)
    // The future show is today only if one hour from now is still today in IST
    expect(shows.every((s) => new Date(s.startAt) > new Date())).toBe(true)
  })

  it('show filters work like the movie list', async () => {
    await makeShow(chandni, istDateTime(TOMORROW, '13:00'), { format: '3D', subtitles: true })
    await makeShow(chandni, istDateTime(TOMORROW, '18:00'), { language: 'Tamil', tags: ['parent_baby'], wheelchairFriendly: true })
    const times = async (q) => (await list(`city=hyderabad&date=${TOMORROW}&${q}`)).body.items.flatMap((g) => g.shows.map((s) => s.startTime))
    expect(await times('format=3D')).toEqual(['13:00'])
    expect(await times('subtitles=true')).toEqual(['13:00'])
    expect(await times('language=Tamil')).toEqual(['18:00'])
    expect(await times('parentBaby=true')).toEqual(['18:00'])
    expect(await times('wheelchair=true')).toEqual(['18:00'])
    expect(await times('format=3D&language=Tamil')).toEqual([]) // filters combine
  })

  it('a day outside today … +6 → 400; inactive or unknown movie → 404', async () => {
    expect((await list(`city=hyderabad&date=${istToday(-1)}`)).status).toBe(400)
    expect((await list(`city=hyderabad&date=${istToday(7)}`)).status).toBe(400)
    expect((await list(`city=hyderabad&date=${TOMORROW}`, new mongoose.Types.ObjectId())).status).toBe(404)
    await Movie.updateOne({ _id: movie._id }, { status: 'inactive' })
    expect((await list(`city=hyderabad&date=${TOMORROW}`)).status).toBe(404)
  })

  it('no shows → empty list', async () => {
    expect((await list(`city=hyderabad&date=${TOMORROW}`)).body).toEqual({ date: TOMORROW, items: [] })
  })
})
