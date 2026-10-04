import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useCreateShows, useMyShow, useOwnerMovies, useUpdateShow } from '../../api/ownerShows.js'
import { useTheatreScreens } from '../../api/ownerScreens.js'
import { useMyTheatres } from '../../api/ownerTheatres.js'
import Button from '../../components/ui/Button.jsx'
import Card from '../../components/ui/Card.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { fieldErrors } from '../../validation/auth.js'
import {
  CLASS_NAMES,
  dayChoices,
  EMPTY_SHOW_FORM,
  formatShortDay,
  formatTime12,
  formToBody,
  istToday,
  MAX_DAYS_AHEAD,
  MAX_DATES,
  neededClasses,
  showErrors,
  showFormSchema,
  showPreview,
  showToForm,
} from '../../validation/shows.js'

// O-05: new show(s) (/owner/shows/new) or edit one show (/owner/shows/:id)
export default function OwnerShowFormPage() {
  const { id } = useParams()
  const theatres = useMyTheatres()
  const movies = useOwnerMovies()
  const show = useMyShow(id)

  const error = theatres.error ?? movies.error ?? show.error
  if (error) {
    return (
      <p role="alert" className="font-bold text-(--tone-alert)">
        {error.message}{' '}
        <Link to="/owner/shows" className="underline">
          Back to shows
        </Link>
      </p>
    )
  }
  if (!theatres.data || !movies.data || (id && !show.data)) return <p role="status">Loading…</p>
  return <ShowForm key={id ?? 'new'} id={id} theatres={theatres.data} movies={movies.data} show={show.data} />
}

function ShowForm({ id, theatres, movies, show }) {
  const navigate = useNavigate()
  const edit = Boolean(id)
  const create = useCreateShows()
  const update = useUpdateShow(id)
  const save = edit ? update : create
  const [form, setForm] = useState(() => {
    if (show) return showToForm(show, show.theatre.id)
    const approved = theatres.filter((t) => t.status === 'approved')
    return { ...EMPTY_SHOW_FORM, theatreId: approved.length === 1 ? approved[0].id : '' }
  })
  const [errors, setErrors] = useState({})
  const screens = useTheatreScreens(form.theatreId)

  const movie = movies.find((m) => m.id === form.movieId) ?? (show && show.movie.id === form.movieId ? { ...show.movie, languages: [show.language] } : undefined)
  const screen = screens.data?.items.find((s) => s.id === form.screenId)
  const set = (changes) => setForm((f) => ({ ...f, ...changes }))

  function submit(e) {
    e.preventDefault()
    const result = showFormSchema({ movie, screen, edit }).safeParse(form)
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      return
    }
    setErrors({})
    const body = formToBody(result.data, screen, { edit })
    save.mutate(body, {
      onSuccess: (data) => {
        const count = data.items?.length ?? 1
        navigate('/owner/shows', { state: { message: edit ? 'Show saved.' : `${count} show${count === 1 ? '' : 's'} added.` } })
      },
      onError: (error) => setErrors(error.code === 'VALIDATION_ERROR' ? showErrors(error.details, { edit }) : {}),
    })
  }

  const serverError = save.error && save.error.code !== 'VALIDATION_ERROR' ? save.error : null
  const theatreOptions = theatres.map((t) => ({ value: t.id, label: t.status === 'approved' ? t.name : `${t.name} (not approved yet)`, disabled: t.status !== 'approved' }))
  const toggleDate = (day) => set({ dates: form.dates.includes(day) ? form.dates.filter((d) => d !== day) : [...form.dates, day] })

  return (
    <div className="space-y-4">
      <p>
        <Link to="/owner/shows" className="font-type underline">
          ← Shows
        </Link>
      </p>
      <h1 className="font-heading text-3xl text-maroon dark:text-gold">{edit ? 'Edit show' : 'New show'}</h1>
      {!edit && <p className="font-type">Only approved theatres can have shows (ROLE-04). Pick several dates to make the same show on each day.</p>}

      <Card>
        <form onSubmit={submit} noValidate className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Theatre"
              placeholder="Pick a theatre"
              options={theatreOptions}
              value={form.theatreId}
              onChange={(e) => set({ theatreId: e.target.value, screenId: '' })}
              error={errors.theatreId}
            />
            <SelectField
              label="Screen"
              placeholder={form.theatreId ? 'Pick a screen' : 'Pick a theatre first'}
              options={(screens.data?.items ?? []).map((s) => ({ value: s.id, label: `${s.name} (${s.format}, ${s.totalSeats} seats)` }))}
              value={form.screenId}
              onChange={(e) => set({ screenId: e.target.value })}
              disabled={!form.theatreId}
              error={errors.screenId}
            />
            <SelectField
              label="Movie"
              placeholder="Pick a movie"
              options={movies.map((m) => ({ value: m.id, label: `${m.title} (${m.certificate}${m.status === 'coming_soon' ? `, from ${formatShortDay(m.releaseDate)}` : ''})` }))}
              value={form.movieId}
              onChange={(e) => {
                const picked = movies.find((m) => m.id === e.target.value)
                set({ movieId: e.target.value, language: picked?.languages.length === 1 ? picked.languages[0] : '', ...(picked?.certificate === 'A' && { parentBaby: false }) })
              }}
              error={errors.movieId}
            />
          </div>
          {form.theatreId && screens.data?.items.length === 0 && (
            <p className="font-type">
              This theatre has no screens yet.{' '}
              <Link to={`/owner/theatres/${form.theatreId}/screens/new`} className="underline">
                Add a screen
              </Link>
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Language"
              placeholder={movie ? 'Pick a language' : 'Pick a movie first'}
              options={(movie?.languages ?? []).map((l) => ({ value: l, label: l }))}
              value={form.language}
              onChange={(e) => set({ language: e.target.value })}
              disabled={!movie}
              error={errors.language}
            />
            <SelectField
              label="Format"
              options={[
                { value: '2D', label: '2D' },
                { value: '3D', label: '3D', disabled: screen?.format === '2D' },
              ]}
              value={form.format}
              onChange={(e) => set({ format: e.target.value })}
              error={errors.format}
            />
            <TextField label="Start time (IST)" type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} error={errors.startTime} />
          </div>

          <fieldset className="space-y-1">
            <legend className="font-type">Extras</legend>
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={form.subtitles} onChange={(e) => set({ subtitles: e.target.checked })} className="h-5 w-5 accent-maroon" />
              Subtitles
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={form.parentBaby}
                onChange={(e) => set({ parentBaby: e.target.checked })}
                disabled={movie?.certificate === 'A'}
                aria-describedby={movie?.certificate === 'A' ? 'parent-baby-hint' : undefined}
                className="h-5 w-5 accent-maroon"
              />
              Parent-and-baby show
            </label>
            {movie?.certificate === 'A' && (
              <p id="parent-baby-hint" className="text-sm">
                Not allowed for &quot;A&quot; movies.
              </p>
            )}
            {errors.parentBaby && <p className="text-sm font-bold text-(--tone-alert)">{errors.parentBaby}</p>}
          </fieldset>

          {edit ? (
            <TextField
              label="Date"
              type="date"
              min={istToday()}
              max={istToday(MAX_DAYS_AHEAD)}
              value={form.date}
              onChange={(e) => set({ date: e.target.value })}
              error={errors.date}
            />
          ) : (
            <fieldset className="space-y-2">
              <legend className="font-type">
                Dates (up to {MAX_DATES}; {form.dates.length} picked)
              </legend>
              <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-7">
                {dayChoices().map((day) => (
                  <label key={day} className="flex min-h-11 items-center gap-2 rounded-btn border border-ink/30 px-2 has-checked:border-ink has-checked:bg-cream">
                    <input type="checkbox" checked={form.dates.includes(day)} onChange={() => toggleDate(day)} className="h-5 w-5 accent-maroon" />
                    <span className="text-sm">{formatShortDay(day)}</span>
                  </label>
                ))}
              </div>
              {errors.dates && <p className="text-sm font-bold text-(--tone-alert)">{errors.dates}</p>}
            </fieldset>
          )}

          <fieldset className="space-y-2">
            <legend className="font-type">Ticket prices in ₹ (GST included, whole rupees)</legend>
            {screen ? (
              <div className="grid gap-4 sm:grid-cols-3">
                {neededClasses(screen).map((c) => (
                  <TextField key={c} label={`${CLASS_NAMES[c]} (${screen.seatCount[c]} seats)`} inputMode="numeric" value={form.prices[c]} onChange={(e) => set({ prices: { ...form.prices, [c]: e.target.value } })} />
                ))}
              </div>
            ) : (
              <p className="text-sm">Pick a screen to see its seat classes.</p>
            )}
            {errors.prices && <p className="text-sm font-bold text-(--tone-alert)">{errors.prices}</p>}
          </fieldset>

          {/* Live preview: label (BR-22) and end time (BR-10) */}
          {movie && screen && /^\d{2}:\d{2}$/.test(form.startTime) && movie.durationMinutes && (
            <p aria-live="polite" className="font-type">
              {showPreview(form.startTime, movie, screen)}
            </p>
          )}

          {serverError && <ServerError error={serverError} />}

          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : edit ? 'Save changes' : 'Add show'}
          </Button>
        </form>
      </Card>
    </div>
  )
}

// Overlap (T-08): say which dates and which shows are in the way
function ServerError({ error }) {
  return (
    <div role="alert" className="space-y-1 font-bold text-(--tone-alert)">
      <p>{error.message}</p>
      {error.code === 'SHOW_OVERLAP' && (
        <ul className="list-inside list-disc font-normal">
          {error.details.clashes.map((c) => (
            <li key={`${c.date}-${c.startTime}`}>
              {formatShortDay(c.date)}: {c.movieTitle}, {formatTime12(c.startTime)} – {formatTime12(c.endTime)} (incl. cleaning)
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
