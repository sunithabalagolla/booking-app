import { Movie } from '../../models/Movie.js'
import { storeImage } from '../../services/upload/index.js'
import { istDayToDate, istToday } from '../../utils/time.js'
import { posterSvg } from '../posters.js'
import { SAMPLE } from '../sample.js'

// Seed step: 6 made-up sample movies (15.5): 4 now showing, 2 coming soon.
// Posters are colourful SVGs drawn by code (seed/posters.js), saved like uploads
// (Cloudinary when keys exist, else the local folder). Upsert by title, so the
// seed can run again.

const MOVIES = [
  {
    slug: 'sapnon-ka-safar',
    title: 'Sapnon Ka Safar',
    tagline: 'A journey of dreams',
    genres: ['Drama', 'Romance'],
    languages: ['Hindi'],
    certificate: 'UA',
    durationMinutes: 148,
    status: 'now_showing',
    releaseInDays: -10,
    cast: ['Meera Kapoor', 'Arjun Mehra', 'Sunil Rao'],
    poster: 'sapnon', // seed/posters.js picture + palette
  },
  {
    slug: 'ghost-of-gulmohar-lane',
    title: 'Ghost of Gulmohar Lane',
    tagline: 'Some doors should stay shut',
    genres: ['Horror', 'Mystery'],
    languages: ['Hindi', 'English'],
    certificate: 'A', // U-08: shows the 18+ warning
    durationMinutes: 122,
    status: 'now_showing',
    releaseInDays: -3,
    cast: ['Kavya Iyer', 'Rohan Das'],
    poster: 'ghost', // seed/posters.js picture + palette
  },
  {
    slug: 'kadal-kaatru',
    title: 'Kadal Kaatru',
    tagline: 'Songs of the sea breeze',
    genres: ['Romance', 'Musical'],
    languages: ['Tamil', 'Telugu'],
    certificate: 'U',
    durationMinutes: 135,
    status: 'now_showing',
    releaseInDays: -17,
    cast: ['Lakshmi Narayanan', 'Karthik Raman'],
    poster: 'kadal', // seed/posters.js picture + palette
  },
  {
    slug: 'operation-monsoon',
    title: 'Operation Monsoon',
    tagline: 'One storm. One mission.',
    genres: ['Action', 'Thriller'],
    languages: ['Hindi', 'Tamil', 'Telugu'],
    certificate: 'UA',
    durationMinutes: 156,
    status: 'now_showing',
    releaseInDays: -1,
    cast: ['Vikrant Singh', 'Ananya Bose', 'Imran Qureshi'],
    poster: 'monsoon', // seed/posters.js picture + palette
  },
  {
    slug: 'chandamama-express',
    title: 'Chandamama Express',
    tagline: 'All aboard for the moon',
    genres: ['Animation', 'Family'],
    languages: ['Kannada', 'Telugu'],
    certificate: 'U',
    durationMinutes: 98,
    status: 'coming_soon',
    releaseInDays: 14,
    cast: [],
    poster: 'chandamama', // seed/posters.js picture + palette
  },
  {
    slug: 'star-voyage-1983',
    title: 'Star Voyage 1983',
    tagline: 'Beyond the last cinema hall',
    genres: ['Sci-Fi', 'Fantasy'],
    languages: ['English', 'Hindi'],
    certificate: 'UA',
    durationMinutes: 131,
    status: 'coming_soon',
    releaseInDays: 30,
    cast: ['Neel Varma', 'Zoya Khan'],
    poster: 'star', // seed/posters.js picture + palette
  },
]

export default {
  name: 'movies',
  async run() {
    for (const m of MOVIES) {
      const svg = posterSvg({ title: m.title, tagline: m.tagline, languages: m.languages, certificate: m.certificate, picture: m.poster })
      const posterUrl = await storeImage(Buffer.from(svg), { kind: 'poster', ext: 'svg', name: `sample-${m.slug}` })

      await Movie.findOneAndUpdate(
        { title: m.title, isSample: true },
        {
          $set: {
            title: m.title,
            tagline: m.tagline,
            posterUrl,
            genres: m.genres,
            languages: m.languages,
            certificate: m.certificate,
            durationMinutes: m.durationMinutes,
            status: m.status,
            releaseDate: istDayToDate(istToday(m.releaseInDays)),
            cast: m.cast.map((name) => ({ name })),
            ...SAMPLE,
          },
        },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true },
      )
    }
    return [`Movies: ${MOVIES.length} sample movies (4 now showing, 2 coming soon)`]
  },
}
