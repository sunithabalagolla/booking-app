import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useCreateStaff, useMyStaff, useUpdateStaff } from '../../api/ownerStaff.js'
import { useMyTheatres } from '../../api/ownerTheatres.js'
import Button from '../../components/ui/Button.jsx'
import Card from '../../components/ui/Card.jsx'
import CheckboxGroup from '../../components/ui/CheckboxGroup.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { fieldErrors } from '../../validation/auth.js'
import { editStaffSchema, EMPTY_STAFF, formToBody, newStaffSchema, staffToForm } from '../../validation/staff.js'

// O-09: new staff login (/owner/staff/new) or edit one (/owner/staff/:id).
// The staff member comes from the staff list.
export default function OwnerStaffFormPage() {
  const { id } = useParams()
  const staff = useMyStaff()
  const theatres = useMyTheatres()
  const backLink = (
    <Link to="/owner/staff" className="underline">
      Back to gate staff
    </Link>
  )

  const error = staff.error ?? theatres.error
  if (error) {
    return (
      <p role="alert" className="font-bold text-(--tone-alert)">
        {error.message} {backLink}
      </p>
    )
  }
  if (!staff.data || !theatres.data) return <p role="status">Loading…</p>
  if (theatres.data.length === 0) {
    return (
      <p className="font-type">
        Add a theatre first, then add staff for it. <Link to="/owner/theatres" className="underline">My theatres</Link>
      </p>
    )
  }
  if (!id) return <StaffForm key="new" theatres={theatres.data} />

  const person = staff.data.find((s) => s.id === id)
  if (!person) {
    return (
      <p role="alert" className="font-bold text-(--tone-alert)">
        We could not find this staff login. {backLink}
      </p>
    )
  }
  return <StaffForm key={id} theatres={theatres.data} person={person} />
}

function StaffForm({ theatres, person }) {
  const navigate = useNavigate()
  const create = useCreateStaff()
  const update = useUpdateStaff()
  const save = person ? update : create
  const [form, setForm] = useState(person ? staffToForm(person) : EMPTY_STAFF)
  const [errors, setErrors] = useState({})

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))
  const theatreOptions = theatres.map((t) => ({ value: t.id, label: t.name }))

  function submit(e) {
    e.preventDefault()
    const result = (person ? editStaffSchema : newStaffSchema).safeParse(form)
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      return
    }
    setErrors({})
    const body = formToBody({ ...form, ...result.data }, { isNew: !person })
    const done = person ? (body.password ? 'saved. The new password logs them out everywhere' : 'saved') : 'added. Give them the email and password'
    const onSuccess = () => navigate('/owner/staff', { state: { message: `${body.name}: ${done}.` } })
    // Field problems (and an email already used) go under the fields
    const onError = (error) => setErrors(['VALIDATION_ERROR', 'ALREADY_EXISTS'].includes(error.code) ? (error.details ?? {}) : {})
    if (person) update.mutate({ id: person.id, body }, { onSuccess, onError })
    else create.mutate(body, { onSuccess, onError })
  }

  const serverError = save.error && !['VALIDATION_ERROR', 'ALREADY_EXISTS'].includes(save.error.code) ? save.error : null

  return (
    <div className="space-y-4">
      <p>
        <Link to="/owner/staff" className="font-type underline">
          ← Gate staff
        </Link>
      </p>
      <h1 className="font-heading text-3xl text-maroon dark:text-gold">{person ? `Edit ${person.name}` : 'New gate staff'}</h1>

      <Card>
        <form onSubmit={submit} noValidate className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Name" autoComplete="off" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} />
            {person ? (
              <div className="space-y-1">
                <p className="font-type">Email</p>
                <p className="min-h-11 py-2 break-all">{person.email}</p>
              </div>
            ) : (
              <TextField label="Email" type="email" autoComplete="off" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
            )}
            <TextField
              label={person ? 'New password (optional)' : 'Password'}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              hint={person ? 'Leave empty to keep the old password. A new password logs them out everywhere.' : 'At least 8 characters, 1 letter and 1 number. Give it to them in person.'}
              error={errors.password}
            />
          </div>

          <CheckboxGroup
            legend="Theatres they scan for"
            options={theatreOptions}
            value={form.theatreIds}
            onChange={(ids) => set('theatreIds', ids)}
            error={errors.theatreIds}
          />

          {serverError && (
            <p role="alert" className="font-bold text-(--tone-alert)">
              {serverError.message}
            </p>
          )}

          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : person ? 'Save changes' : 'Add staff'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
