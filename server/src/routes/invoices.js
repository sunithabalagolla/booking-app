import { Router } from 'express'
import { sendPdf } from '../controllers/bookings.js'
import { requireAuth } from '../middleware/auth.js'
import { requireApprovedOwner, requireRole } from '../middleware/role.js'
import { validate } from '../middleware/validate.js'
import { Invoice } from '../models/Invoice.js'
import { invoiceFileName } from '../services/bookingEmail.js'
import { invoicePdf } from '../services/pdf/invoicePdf.js'
import { AppError } from '../utils/AppError.js'
import { idParams } from '../validation/common.js'

// /api/invoices (api.md Section 6, 11.3): GST invoice PDF, made from the stored data.
// User: own invoices · Owner: invoices of their theatres (ROLE-02) · Admin: all.
// Someone else's invoice looks the same as a missing one (404).
const router = Router()

router.use(requireAuth, requireRole('user', 'owner', 'admin'), requireApprovedOwner)

router.get('/:id/pdf', validate({ params: idParams }), async (req, res) => {
  const invoice = await Invoice.findById(req.valid.params.id)
  const me = String(req.user._id)
  const allowed =
    invoice &&
    (req.user.role === 'admin' || (req.user.role === 'user' && String(invoice.userId) === me) || (req.user.role === 'owner' && String(invoice.ownerId) === me))
  if (!allowed) throw new AppError(404, 'NOT_FOUND', 'We could not find this invoice.')
  sendPdf(res, invoiceFileName(invoice), await invoicePdf(invoice))
})

export default router
