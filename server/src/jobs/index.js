import cron from 'node-cron'
import { processCancellations } from './cancellationRefunds.js'
import { paymentSafetyCheck } from './paymentSafety.js'
import { releaseExpiredHolds } from './releaseExpiredHolds.js'

// Background jobs (requirements: JOB-01 … JOB-07). They run inside the server with
// node-cron; there are no endpoints. Times are IST (BR-21). JOB-03, JOB-05 … JOB-07 come later.

// A job error is logged and the job runs again next time; it never stops the server.
// noOverlap: a slow run is not started twice at the same time.
function every(expression, name, job) {
  return cron.schedule(
    expression,
    async () => {
      try {
        await job()
      } catch (error) {
        console.error(`[${name}] failed: ${error.message}`)
      }
    },
    { name, timezone: 'Asia/Kolkata', noOverlap: true },
  )
}

export function startJobs() {
  return [
    every('* * * * *', 'JOB-01 release expired holds', releaseExpiredHolds), // every minute
    every('*/5 * * * *', 'JOB-02 payment safety check', paymentSafetyCheck), // every 5 minutes
    every('* * * * *', 'JOB-04 cancellation refunds', processCancellations), // every minute
  ]
}
