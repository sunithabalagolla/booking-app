import { z } from 'zod'
import { THEMES } from '../models/User.js'

// PATCH /api/me/prefs (UI-02, UI-40, UI-41). Every field is optional, but at
// least one must be sent. Unknown fields are dropped (api.md 1.4).
export const prefsSchema = z
  .object({
    theme: z.enum(THEMES, { error: 'Theme must be auto, day or night.' }).optional(),
    sound: z.boolean({ error: 'Sound must be true or false.' }).optional(),
    reduceMotion: z.boolean({ error: 'Reduce motion must be true or false.' }).optional(),
  })
  .refine((prefs) => Object.values(prefs).some((value) => value !== undefined), {
    error: 'Send at least one setting.',
  })
