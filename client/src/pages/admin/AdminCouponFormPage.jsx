import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAdminCoupon, useApprovedTheatres, useCreateCoupon, useEndCoupon, useUpdateCoupon } from '../../api/adminCoupons.js'
import { useAdminSettings } from '../../api/settings.js'
import Button from '../../components/ui/Button.jsx'
import Card from '../../components/ui/Card.jsx'
import CheckboxGroup from '../../components/ui/CheckboxGroup.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { fieldErrors } from '../../validation/auth.js'
import { COUPON_STATUS_LABELS, COUPON_STATUS_TONES, couponFormSchema, couponToForm, EMPTY_COUPON, formToBody, usedText } from '../../validation/coupons.js'

// A-06: add a coupon (/admin/coupons/new) or edit one (/admin/coupons/:id).
// Tickets only (BR-16). Dates are whole IST days. No delete: "End now" ends it at once
// and keeps the history (decided 2026-10-06). "Show to users" = listed in Available
// offers on the bill (U-15); off = secret code.
export default function AdminCouponFormPage() {
  const { id } = useParams()
  const coupon = useAdminCoupon(id)

  if (!id) return <CouponForm key="new" />
  if (coupon.isError) {
    return (
      <p role="alert" className="font-bold text-(--tone-alert)">
        {coupon.error.message}{' '}
        <Link to="/admin/coupons" className="underline">
          Back to coupons
        </Link>
      </p>
    )
  }
  if (!coupon.data) return <p role="status">Loading…</p>
  return <CouponForm key={id} id={id} coupon={coupon.data} />
}

function CouponForm({ id, coupon }) {
  const navigate = useNavigate()
  const create = useCreateCoupon()
  const update = useUpdateCoupon(id)
  const end = useEndCoupon(id)
  const save = id ? update : create
  const settings = useAdminSettings()
  const theatres = useApprovedTheatres()
  const [form, setForm] = useState(() => (coupon ? couponToForm(coupon) : EMPTY_COUPON))
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState(null)
  const [confirmEnd, setConfirmEnd] = useState(false)

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }))
    setMessage(null)
  }
  const change = (field) => (e) => set(field, e.target.value)
  const percent = form.discountType === 'percent'

  // Theatres to choose from: in the picked cities (all cities when none is picked)
  const cityOptions = (settings.data?.cities ?? []).map((c) => ({ value: c.code, label: c.name }))
  const theatreOptions = (theatres.data ?? []).filter((t) => !form.cityCodes.length || form.cityCodes.includes(t.city.code)).map((t) => ({ value: t.id, label: `${t.name} (${t.city.name})` }))

  function submit(e) {
    e.preventDefault()
    const result = couponFormSchema.safeParse(form)
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      return
    }
    setErrors({})
    // A theatre outside the picked cities is not sent
    const theatreIds = form.theatreIds.filter((tid) => theatreOptions.some((t) => t.value === tid))
    const body = formToBody({ ...form, theatreIds }, { isNew: !id })
    save.mutate(body, {
      onSuccess: () => {
        if (!id) navigate('/admin/coupons', { state: { message: `Coupon ${body.code} added.` } })
        else setMessage('Saved.')
      },
      onError: (error) => setErrors(toFormErrors(error.details ?? {})),
    })
  }

  function endNow() {
    end.mutate(undefined, {
      onSuccess: () => {
        setConfirmEnd(false)
        setMessage('Coupon ended. It can no longer be used.')
      },
      onError: (error) => setMessage(error.message),
    })
  }

  const serverError = save.error && !save.error.details ? save.error : null

  return (
    <div className="space-y-4">
      <p>
        <Link to="/admin/coupons" className="font-type underline">
          ← All coupons
        </Link>
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-heading text-3xl text-maroon dark:text-gold">{id ? `Coupon ${coupon.code}` : 'Add coupon'}</h1>
        {coupon && <Stamp tone={COUPON_STATUS_TONES[coupon.status]}>{COUPON_STATUS_LABELS[coupon.status]}</Stamp>}
      </div>
      {coupon && <p className="font-type">{usedText(coupon)} (not given back when a booking is cancelled)</p>}

      <Card>
        <form onSubmit={submit} noValidate className="space-y-6">
          {!id && (
            <TextField
              label="Code"
              hint="3 to 20 letters or numbers. Users type it at the booking summary. It cannot change later."
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              maxLength={20}
              autoComplete="off"
              error={errors.code}
            />
          )}

          {/* "Show to users" switch (added 2026-10-06) */}
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input type="checkbox" role="switch" checked={form.isPublic} onChange={(e) => set('isPublic', e.target.checked)} className="h-6 w-6 accent-maroon" />
            <span>
              <span className="block font-type font-bold">Show to users</span>
              <span className="block text-sm">{form.isPublic ? 'Public offer: listed in "Available offers" on the bill.' : 'Secret code: works only when someone types it.'}</span>
            </span>
          </label>

          <fieldset className="space-y-1">
            <legend className="font-type">Discount on tickets</legend>
            <div className="flex flex-wrap gap-x-6">
              {[
                ['percent', 'Percent off'],
                ['flat', 'Flat rupees off'],
              ].map(([value, label]) => (
                <label key={value} className="inline-flex min-h-11 cursor-pointer items-center gap-2">
                  <input type="radio" name="discountType" value={value} checked={form.discountType === value} onChange={() => set('discountType', value)} className="h-5 w-5 accent-maroon" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label={percent ? 'Percent (1–100)' : 'Rupees off (₹)'} inputMode="numeric" value={form.value} onChange={change('value')} error={errors.value} />
            {percent && <TextField label="Max discount (₹, optional)" inputMode="numeric" value={form.maxDiscount} onChange={change('maxDiscount')} error={errors.maxDiscount} />}
            <TextField label="Min ticket amount (₹, optional)" inputMode="numeric" value={form.minAmount} onChange={change('minAmount')} error={errors.minAmount} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Start date" type="date" hint="From 12:00 AM IST." value={form.startDate} onChange={change('startDate')} error={errors.startDate} />
            <TextField label="End date" type="date" hint="Until 11:59 PM IST." value={form.endDate} onChange={change('endDate')} error={errors.endDate} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Total uses (optional)" hint="Empty = no limit." inputMode="numeric" value={form.totalLimit} onChange={change('totalLimit')} error={errors.totalLimit} />
            <TextField label="Uses per user (optional)" hint="Empty = no limit." inputMode="numeric" value={form.perUserLimit} onChange={change('perUserLimit')} error={errors.perUserLimit} />
          </div>

          <CheckboxGroup legend="Only in these cities (optional)" hint="None ticked = all cities." options={cityOptions} value={form.cityCodes} onChange={(v) => set('cityCodes', v)} error={errors.cityCodes} />
          {theatreOptions.length > 0 && (
            <CheckboxGroup
              legend="Only at these theatres (optional)"
              hint="None ticked = every theatre in the cities above."
              options={theatreOptions}
              value={form.theatreIds}
              onChange={(v) => set('theatreIds', v)}
              error={errors.theatreIds}
            />
          )}

          {serverError && (
            <p role="alert" className="font-bold text-(--tone-alert)">
              {serverError.message}
            </p>
          )}
          {message && (
            <p role="status" className="font-type font-bold">
              {message}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : id ? 'Save changes' : 'Add coupon'}
            </Button>
          </div>
        </form>
      </Card>

      {/* End now (no delete): ends at once, keeps the coupon and its uses */}
      {coupon && coupon.status !== 'ended' && (
        <Card>
          <div className="space-y-3">
            <p className="font-type font-bold">End this coupon now</p>
            <p className="text-sm">Nobody can use it after this. It stays in the register with its uses.</p>
            {confirmEnd ? (
              <div className="flex flex-wrap gap-3">
                <Button onClick={endNow} disabled={end.isPending}>
                  Yes, end now
                </Button>
                <Button variant="secondary" onClick={() => setConfirmEnd(false)}>
                  Keep it
                </Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setConfirmEnd(true)}>
                End now
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

// Server field names (paise) → form field names (rupees)
function toFormErrors(details) {
  const names = { maxDiscountPaise: 'maxDiscount', minAmountPaise: 'minAmount' }
  return Object.fromEntries(Object.entries(details).map(([key, message]) => [names[key] ?? key, message]))
}
