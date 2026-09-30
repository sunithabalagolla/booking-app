import { AppError } from '../utils/AppError.js'

// Every error answer has the same shape (api.md 1.5):
//   { error: { code, message, details, requestId } }
function send(res, req, status, code, message, details) {
  res.status(status).json({ error: { code, message, details, requestId: req.id } })
}

// Any /api path that no route answered
export function notFound(req, res) {
  send(res, req, 404, 'NOT_FOUND', 'This reel is missing from the projector room.')
}

// Express calls this for thrown errors (Express 5 also catches async errors)
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return send(res, req, err.status, err.code, err.message, err.details)
  }

  // Body is not valid JSON, or too big
  if (err.type === 'entity.parse.failed') {
    return send(res, req, 400, 'VALIDATION_ERROR', 'The request body is not valid JSON.')
  }
  if (err.type === 'entity.too.large') {
    return send(res, req, 413, 'VALIDATION_ERROR', 'The request body is too big.')
  }

  // Unique index broken (e.g. two sign ups with the same email at the same moment)
  if (err.code === 11000 && err.keyPattern?.email) {
    return send(res, req, 409, 'EMAIL_TAKEN', 'This email already has an account.')
  }

  console.error(`[${req.id}] ${req.method} ${req.originalUrl}`, err)
  send(res, req, 500, 'SERVER_ERROR', 'Sorry for the interruption. Our projector operator is fixing the reel. Please try again.')
}
