import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useCreateScreen, useMyScreen, useUpdateScreen } from '../../api/ownerScreens.js'
import { useMyTheatre } from '../../api/ownerTheatres.js'
import Button from '../../components/ui/Button.jsx'
import Card from '../../components/ui/Card.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { fieldErrors } from '../../validation/auth.js'
import { emptyScreenForm, formToBody, screenFormSchema, screenToForm } from '../../validation/screens.js'
import SeatLayoutEditor from './SeatLayoutEditor.jsx'

// O-04: add a screen (/owner/theatres/:theatreId/screens/new) or edit one (/owner/screens/:id)
export default function OwnerScreenFormPage() {
  const { id, theatreId } = useParams()
  const screen = useMyScreen(id)
  const theatre = useMyTheatre(id ? undefined : theatreId)

  const error = screen.error ?? theatre.error
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
  if (id) {
    if (!screen.data) return <p role="status">Loading…</p>
    return <ScreenForm key={id} id={id} theatre={screen.data.theatre} screen={screen.data.screen} />
  }
  if (!theatre.data) return <p role="status">Loading…</p>
  return <ScreenForm key="new" theatre={theatre.data} />
}

// Server field names → form field names (layout.* errors show under the grid)
function formErrors(details = {}) {
  const errors = {}
  for (const [key, message] of Object.entries(details)) errors[key.startsWith('layout') ? 'grid' : key] ??= message
  return errors
}

function ScreenForm({ id, theatre, screen }) {
  const navigate = useNavigate()
  const create = useCreateScreen(theatre.id)
  const update = useUpdateScreen(id)
  const save = id ? update : create
  const [form, setForm] = useState(screen ? screenToForm(screen) : emptyScreenForm())
  const [errors, setErrors] = useState({})

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))
  const change = (field) => (e) => set(field, e.target.value)
  const screensPath = `/owner/theatres/${theatre.id}/screens`

  function submit(e) {
    e.preventDefault()
    const result = screenFormSchema.safeParse(form)
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      return
    }
    setErrors({})
    const body = formToBody(result.data)
    save.mutate(body, {
      onSuccess: () => {
        if (!id) navigate(screensPath, { state: { message: `"${body.name}" added.` } })
      },
      // Field problems (and a name already used) go under the fields
      onError: (error) => setErrors(['VALIDATION_ERROR', 'ALREADY_EXISTS'].includes(error.code) ? formErrors(error.details) : {}),
    })
  }

  const serverError = save.error && !['VALIDATION_ERROR', 'ALREADY_EXISTS'].includes(save.error.code) ? save.error : null

  return (
    <div className="space-y-4">
      <p>
        <Link to={screensPath} className="font-type underline">
          ← Screens of {theatre.name}
        </Link>
      </p>
      <h1 className="font-heading text-3xl text-maroon dark:text-gold">{id ? `Edit ${screen.name}` : 'Add screen'}</h1>
      <p className="font-type">{theatre.name}</p>

      <Card>
        <form onSubmit={submit} noValidate className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Screen name" placeholder="Screen 1" value={form.name} onChange={change('name')} error={errors.name} />
            <SelectField
              label="Format"
              options={[
                { value: '2D', label: '2D' },
                { value: '3D', label: '3D' },
              ]}
              value={form.format}
              onChange={change('format')}
              error={errors.format}
            />
            <TextField
              label="Cleaning break (minutes)"
              type="number"
              inputMode="numeric"
              min="0"
              max="120"
              value={form.cleaningBreakMinutes}
              onChange={change('cleaningBreakMinutes')}
              hint={id ? 'Time between two shows (BR-09).' : 'Time between two shows. Leave empty for the platform default.'}
              error={errors.cleaningBreakMinutes}
            />
          </div>

          <section className="space-y-2">
            <h2 className="font-type text-xl">Seat layout</h2>
            <p className="text-sm">
              Row letters and seat numbers are made for you: row A is nearest the screen; seats are numbered left to right. Wheelchair-friendly is set by
              itself when the screen has a wheelchair space.
            </p>
            <SeatLayoutEditor grid={form.grid} onChange={(grid) => set('grid', grid)} error={errors.grid} />
          </section>

          {id && <p className="text-sm">Layout changes do not change shows that already exist.</p>}

          {serverError && (
            <p role="alert" className="font-bold text-(--tone-alert)">
              {serverError.message}
            </p>
          )}
          {id && update.isSuccess && !update.isPending && (
            <p role="status" className="font-type">
              Saved.
            </p>
          )}

          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : id ? 'Save changes' : 'Add screen'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
