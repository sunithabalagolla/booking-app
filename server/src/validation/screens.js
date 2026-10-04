import { z } from 'zod'
import { MAX_COLS, MAX_ROWS, SEAT_CLASSES } from '../utils/seatLayout.js'

// O-04 screen fields (api.md Section 8). Row letters, seat IDs, seat counts and
// wheelchair-friendly are made by the server (utils/seatLayout.js), never sent.

const cellField = z.discriminatedUnion(
  'type',
  [
    z.object({
      type: z.literal('seat'),
      seatClass: z.enum(SEAT_CLASSES, { error: 'Each seat needs a class: Balcony, First class or Second class.' }),
      wheelchair: z.boolean().optional(),
    }),
    z.object({ type: z.literal('aisle') }),
    z.object({ type: z.literal('blocked') }),
  ],
  { error: 'Each place must be a seat, an aisle or blocked.' },
)

// Grid of rows × columns; every row has the same number of cells
const layoutField = z
  .object({
    rows: z.number().int().min(1, { error: 'At least 1 row.' }).max(MAX_ROWS, { error: `At most ${MAX_ROWS} rows (A to Z).` }),
    cols: z.number().int().min(1, { error: 'At least 1 column.' }).max(MAX_COLS, { error: `At most ${MAX_COLS} columns.` }),
    grid: z.array(z.object({ cells: z.array(cellField).max(MAX_COLS) })).max(MAX_ROWS),
  })
  .superRefine((layout, ctx) => {
    if (layout.grid.length !== layout.rows || layout.grid.some((row) => row.cells.length !== layout.cols)) {
      ctx.addIssue({ code: 'custom', path: ['grid'], message: 'The layout does not match its rows and columns.' })
      return
    }
    if (!layout.grid.some((row) => row.cells.some((cell) => cell.type === 'seat'))) {
      ctx.addIssue({ code: 'custom', path: ['grid'], message: 'The screen needs at least 1 seat.' })
    }
  })

const screenFields = {
  name: z.string({ error: 'Please enter the screen name.' }).trim().min(1, { error: 'Please enter the screen name.' }).max(50, { error: 'The name can have at most 50 characters.' }),
  format: z.enum(['2D', '3D'], { error: 'Please pick 2D or 3D.' }),
  // BR-09; same range as the admin setting
  cleaningBreakMinutes: z
    .number({ error: 'Please enter the cleaning break in minutes.' })
    .int({ error: 'Please enter whole minutes.' })
    .min(0, { error: 'The cleaning break must be 0 to 120 minutes.' })
    .max(120, { error: 'The cleaning break must be 0 to 120 minutes.' }),
  layout: layoutField,
}

// cleaningBreakMinutes left out → the default from settings
export const createScreenSchema = z.object({ ...screenFields, cleaningBreakMinutes: screenFields.cleaningBreakMinutes.optional() })

export const updateScreenSchema = z
  .object(screenFields)
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), { error: 'Nothing to change.' })
