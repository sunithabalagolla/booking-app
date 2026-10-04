// List of seed steps, run in this order by ../index.js.
//
// How to add a step (when the models for that area exist):
//   1. Create a file here, e.g. settings.js:
//
//        import { SAMPLE } from '../sample.js'
//        export default {
//          name: 'settings',
//          async run() {
//            await Settings.create({ _id: 'platform', ...values, ...SAMPLE })
//            return ['Settings: 1 document']   // lines for the summary (optional)
//          },
//        }
//
//   2. Import it below and add it to the array.
//   Order matters: settings → users → movies → theatres → screens → food → shows → coupons.

import food from './food.js'
import movies from './movies.js'
import screens from './screens.js'
import settings from './settings.js'
import theatres from './theatres.js'
import users from './users.js'

export const steps = [settings, users, movies, theatres, screens, food]
