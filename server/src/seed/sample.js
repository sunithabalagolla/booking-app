// Every seeded document gets this field, so sample data is clearly marked (15.5)
export const SAMPLE = { isSample: true }

// Password for all seeded test logins. It comes from .env, never from code (SEC-07).
export function getSeedPassword() {
  const password = process.env.SEED_PASSWORD
  if (!password) {
    throw new Error('SEED_PASSWORD is missing in .env (needed for the test logins).')
  }
  return password
}
