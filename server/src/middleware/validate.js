import { AppError } from '../utils/AppError.js'

// SEC-06: refuse keys that start with "$" or contain "." anywhere in the input,
// so nobody can send MongoDB operators like { "$gt": "" }.
function hasBadKey(value) {
  if (Array.isArray(value)) return value.some(hasBadKey)
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([key, v]) => key.startsWith('$') || key.includes('.') || hasBadKey(v))
  }
  return false
}

// Zod errors → { fieldName: 'message' } for the client form
function fieldErrors(zodError) {
  const details = {}
  for (const issue of zodError.issues) {
    const field = issue.path.join('.') || '_'
    details[field] ??= issue.message
  }
  return details
}

// Checks req.body / req.query / req.params with Zod schemas (SEC-06).
// The clean values (unknown fields dropped) are put in req.valid.body / .query / .params.
//   router.post('/signup', validate({ body: signupSchema }), handler)
export function validate(schemas) {
  return (req, res, next) => {
    req.valid = {}
    for (const part of ['body', 'query', 'params']) {
      if (!schemas[part]) continue
      const input = req[part] ?? {}
      if (hasBadKey(input)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'The request has fields that are not allowed.')
      }
      const result = schemas[part].safeParse(input)
      if (!result.success) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Please check the form.', fieldErrors(result.error))
      }
      req.valid[part] = result.data
    }
    next()
  }
}
