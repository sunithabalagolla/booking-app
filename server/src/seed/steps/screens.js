import { Screen } from '../../models/Screen.js'
import { Theatre } from '../../models/Theatre.js'
import { buildLayout } from '../../utils/seatLayout.js'
import { SAMPLE } from '../sample.js'

// Seed step: 2 sample screens with seat layouts for every sample theatre (15.5).
// Screen 1 (2D, bigger): Balcony at the back, First class in the middle, Second class
// in front, 2 aisles. Screen 2 (3D, smaller): First + Second class, 1 aisle in the middle.
// Theatres with wheelchair access get 2 wheelchair spaces in the front row of Screen 1.
// Upsert by theatre + name, so the seed can run again.

// classes: from the back (top of the map) to the screen, e.g. [['balcony', 3], ['first', 4]]
// aisleCols: column numbers (0 = first) that are aisles. emptyRows: row numbers left as aisles (walkway)
export function sampleGrid({ cols, classes, aisleCols, emptyRows = [], wheelchairCols = [] }) {
  const grid = []
  for (const [seatClass, count] of classes) {
    for (let i = 0; i < count; i++) {
      grid.push({ cells: Array.from({ length: cols }, (_, c) => (aisleCols.includes(c) ? { type: 'aisle' } : { type: 'seat', seatClass, wheelchair: false })) })
    }
  }
  for (const r of emptyRows) grid.splice(r, 0, { cells: Array.from({ length: cols }, () => ({ type: 'aisle' })) })
  // Wheelchair spaces in the front row (nearest the screen)
  for (const c of wheelchairCols) grid[grid.length - 1].cells[c] = { type: 'seat', seatClass: classes.at(-1)[0], wheelchair: true }
  return grid
}

const screensFor = (theatre) => [
  {
    name: 'Screen 1',
    format: '2D',
    cleaningBreakMinutes: 15,
    grid: sampleGrid({
      cols: 18,
      classes: [['balcony', 3], ['first', 5], ['second', 4]],
      aisleCols: [4, 13],
      emptyRows: [3], // walkway between Balcony and First class
      wheelchairCols: theatre.amenities?.wheelchairAccess ? [0, 1] : [],
    }),
  },
  {
    name: 'Screen 2',
    format: '3D',
    cleaningBreakMinutes: 20,
    grid: sampleGrid({ cols: 13, classes: [['first', 4], ['second', 4]], aisleCols: [6] }),
  },
]

export default {
  name: 'screens',
  async run() {
    const theatres = await Theatre.find({ isSample: true })
    let count = 0
    for (const theatre of theatres) {
      for (const s of screensFor(theatre)) {
        const { layout, seatCount, wheelchairFriendly } = buildLayout(s.grid)
        await Screen.findOneAndUpdate(
          { theatreId: theatre._id, name: s.name },
          {
            $set: {
              theatreId: theatre._id,
              ownerId: theatre.ownerId,
              name: s.name,
              format: s.format,
              cleaningBreakMinutes: s.cleaningBreakMinutes,
              wheelchairFriendly,
              layout,
              seatCount,
              ...SAMPLE,
            },
          },
          { upsert: true, runValidators: true, setDefaultsOnInsert: true },
        )
        count += 1
      }
    }
    return [`Screens: ${count} sample screens with seat layouts (2 per theatre)`]
  },
}
