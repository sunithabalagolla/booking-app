import { gateTime, rejectionText } from '../staff/scan.js'

// O-11 canteen counter helpers. Times are IST (BR-21).

// The reason in plain words (e.g. "Already collected at 7:45 PM.")
export function counterRejectionText(result, now = Date.now()) {
  switch (result.reason) {
    case 'no_food':
      return 'This booking has no food order.'
    case 'already_collected':
      return `Already collected at ${gateTime(result.collectedAt, now)}.`
    case 'too_early':
      return `Too early. The counter opens for this show at ${gateTime(result.opensAt, now)}.`
    default:
      return rejectionText(result, now) // same words as the gate scanner
  }
}

// "3 items" (all quantities added up)
export function itemCountText(items) {
  const count = items.reduce((sum, item) => sum + item.qty, 0)
  return `${count} ${count === 1 ? 'item' : 'items'}`
}
