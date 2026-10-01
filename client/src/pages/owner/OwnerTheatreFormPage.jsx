import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useCreateTheatre, useMyTheatre, useOwnerCities, useUpdateTheatre } from '../../api/ownerTheatres.js'
import Button from '../../components/ui/Button.jsx'
import Card from '../../components/ui/Card.jsx'
import ImageUpload from '../../components/ui/ImageUpload.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { fieldErrors } from '../../validation/auth.js'
import {
  EMPTY_THEATRE,
  MAX_THEATRE_PHOTOS,
  THEATRE_STATUS_LABELS,
  THEATRE_STATUS_TONES,
  theatreFormSchema,
  theatreToForm,
} from '../../validation/theatres.js'

// O-03: add a theatre (/owner/theatres/new) or edit one (/owner/theatres/:id)
export default function OwnerTheatreFormPage() {
  const { id } = useParams()
  const cities = useOwnerCities()
  const theatre = useMyTheatre(id)

  const error = cities.error ?? theatre.error
  if (error) {
    return (
      <p role="alert" className="font-bold text-(--tone-alert)">
        {error.message}{' '}
        <Link to="/owner/theatres" className="underline">
          Back to my theatres
        </Link>
      </p>
    )
  }
  if (!cities.data || (id && !theatre.data)) return <p role="status">Loading…</p>
  if (!id) return <TheatreForm key="new" cities={cities.data} />
  return <TheatreForm key={id} id={id} cities={cities.data} theatre={theatre.data} />
}

function TheatreForm({ id, cities, theatre }) {
  const navigate = useNavigate()
  const create = useCreateTheatre()
  const update = useUpdateTheatre(id)
  const save = id ? update : create
  const [form, setForm] = useState(theatre ? theatreToForm(theatre) : EMPTY_THEATRE)
  const [errors, setErrors] = useState({})

  // O-03: city and GSTIN are locked after approval
  const locked = theatre?.status === 'approved'
  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))
  const change = (field) => (e) => set(field, e.target.value)
  const setAmenity = (key) => (e) => set('amenities', { ...form.amenities, [key]: e.target.checked })

  function submit(e) {
    e.preventDefault()
    const result = theatreFormSchema(cities).safeParse(form)
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      return
    }
    setErrors({})
    const body = { ...result.data }
    if (locked) {
      delete body.cityCode
      delete body.gstin
    }
    save.mutate(body, {
      onSuccess: () => {
        if (!id) navigate('/owner/theatres', { state: { message: `"${body.name}" added. It waits for admin approval.` } })
      },
      // Field problems go under the fields; other refusals (e.g. locked city) above the button
      onError: (error) => setErrors(error.code === 'VALIDATION_ERROR' ? (error.details ?? {}) : {}),
    })
  }

  const serverError = save.error && save.error.code !== 'VALIDATION_ERROR' ? save.error : null
  const cityOptions = cities.map((c) => ({ value: c.code, label: `${c.name} (${c.state})` }))

  return (
    <div className="space-y-4">
      <p>
        <Link to="/owner/theatres" className="font-type underline">
          ← My theatres
        </Link>
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-heading text-3xl text-maroon dark:text-gold">{id ? 'Edit theatre' : 'Add theatre'}</h1>
        {theatre && (
          <Stamp tone={THEATRE_STATUS_TONES[theatre.status]} className="text-lg">
            {THEATRE_STATUS_LABELS[theatre.status]}
          </Stamp>
        )}
      </div>

      {!id && <p className="font-type">New theatres are checked by the admin before they go live.</p>}
      {theatre?.status === 'rejected' && (
        <p role="note" className="font-type">
          Rejected: {theatre.rejectReason}. Fix it and save: the theatre goes back to the admin for approval.
        </p>
      )}

      <Card>
        <form onSubmit={submit} noValidate className="space-y-6">
          <TextField label="Theatre name" value={form.name} onChange={change('name')} error={errors.name} />

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="City"
              placeholder="Pick a city"
              options={cityOptions}
              value={form.cityCode}
              onChange={change('cityCode')}
              disabled={locked}
              error={errors.cityCode}
            />
            <TextField
              label="GSTIN"
              value={form.gstin}
              onChange={change('gstin')}
              disabled={locked}
              autoCapitalize="characters"
              hint={locked ? 'City and GSTIN are locked after approval.' : 'Must start with the state code of the city, e.g. 36 for Telangana.'}
              error={errors.gstin}
            />
          </div>

          <TextField label="Address" value={form.address} onChange={change('address')} error={errors.address} />
          <TextField
            label="Map link (optional)"
            type="url"
            placeholder="https://"
            value={form.mapLink}
            onChange={change('mapLink')}
            error={errors.mapLink}
          />

          <fieldset className="space-y-1">
            <legend className="font-type">Amenities</legend>
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={form.amenities.wheelchairAccess} onChange={setAmenity('wheelchairAccess')} className="h-5 w-5 accent-maroon" />
              Wheelchair access
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={form.amenities.parking} onChange={setAmenity('parking')} className="h-5 w-5 accent-maroon" />
              Parking
            </label>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="font-type">
              Photos (optional, up to {MAX_THEATRE_PHOTOS})
            </legend>
            {form.photos.length > 0 && (
              <ul className="flex flex-wrap gap-3">
                {form.photos.map((url, index) => (
                  <li key={url} className="space-y-2">
                    <img src={url} alt={`Theatre photo ${index + 1}`} className="h-24 w-36 rounded-btn border border-ink object-cover" />
                    <Button variant="secondary" onClick={() => set('photos', form.photos.filter((p) => p !== url))}>
                      Remove photo {index + 1}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {form.photos.length < MAX_THEATRE_PHOTOS && (
              // value '' = an empty upload box; each upload adds one photo
              <ImageUpload label="Add a photo" kind="theatre" value="" onChange={(url) => url && set('photos', [...form.photos, url])} previewClass="h-24 w-36" />
            )}
            {errors.photos && <p className="text-sm font-bold text-(--tone-alert)">{errors.photos}</p>}
          </fieldset>

          {serverError && (
            <p role="alert" className="font-bold text-(--tone-alert)">
              {serverError.message}
            </p>
          )}
          {id && update.isSuccess && !update.isPending && (
            <p role="status" className="font-type">
              Saved.{update.data?.theatre?.status === 'pending' && theatre?.status === 'rejected' ? ' It waits for admin approval again.' : ''}
            </p>
          )}

          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : id ? 'Save changes' : 'Add theatre'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
