// SEC-08: security headers (helmet) and the CORS allow-list.
//
// CORS: only the Talkies client may call the API from a browser on another
// origin. The allow-list comes from CLIENT_URL in .env (one URL, or several
// separated by commas). In development the Vite proxy makes calls same-origin,
// so CORS only matters once client and API run on different addresses (Phase 12).

export function allowedOrigins() {
  return (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((url) => url.trim().replace(/\/$/, ''))
    .filter(Boolean)
}

export const corsOptions = {
  // Not on the list (or no Origin header): no CORS headers, so the browser blocks
  // the answer. No error is thrown, so the server does not answer 500.
  origin(origin, callback) {
    callback(null, Boolean(origin) && allowedOrigins().includes(origin))
  },
  credentials: true, // the refresh cookie (SEC-02)
}
