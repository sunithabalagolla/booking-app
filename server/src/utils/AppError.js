// An error with an HTTP status and an error code for the client (api.md 1.5).
// Throw it anywhere in a route; the error middleware turns it into JSON.
//   throw new AppError(409, 'EMAIL_TAKEN', 'This email already has an account.')
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}
