import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAdminMovie, useCreateMovie, useDeleteMovie, useUpdateMovie } from '../../api/adminMovies.js'
import Button from '../../components/ui/Button.jsx'
import Card from '../../components/ui/Card.jsx'
import CheckboxGroup from '../../components/ui/CheckboxGroup.jsx'
import ImageUpload from '../../components/ui/ImageUpload.jsx'
import SelectField from '../../components/ui/SelectField.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { CERTIFICATES, GENRES, LANGUAGES, MOVIE_STATUSES, STATUS_LABELS } from '../../config/movieOptions.js'
import { fieldErrors } from '../../validation/auth.js'
import { EMPTY_MOVIE, movieFormSchema, movieToForm } from '../../validation/movies.js'

// A-02: add a movie (/admin/movies/new) or edit one (/admin/movies/:id)
export default function AdminMovieFormPage() {
  const { id } = useParams()
  const movie = useAdminMovie(id)

  if (!id) return <MovieForm key="new" />
  if (movie.isError) {
    return (
      <p role="alert" className="font-bold text-(--tone-alert)">
        {movie.error.message} <Link to="/admin/movies" className="underline">Back to movies</Link>
      </p>
    )
  }
  if (!movie.data) return <p role="status">Loading…</p>
  // key: a fresh form for each movie
  return <MovieForm key={id} id={id} initial={movieToForm(movie.data.movie)} inUse={movie.data.inUse} />
}

const certificateOptions = CERTIFICATES.map((c) => ({ value: c, label: c }))
const statusOptions = MOVIE_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))

function MovieForm({ id, initial = EMPTY_MOVIE, inUse = false }) {
  const navigate = useNavigate()
  const create = useCreateMovie()
  const update = useUpdateMovie(id)
  const remove = useDeleteMovie(id)
  const save = id ? update : create
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))
  const change = (field) => (e) => set(field, e.target.value)

  const setCast = (index, changes) => set('cast', form.cast.map((c, i) => (i === index ? { ...c, ...changes } : c)))
  const removeCast = (index) => set('cast', form.cast.filter((_, i) => i !== index))

  function submit(e) {
    e.preventDefault()
    const result = movieFormSchema.safeParse(form)
    if (!result.success) {
      setErrors(fieldErrors(result.error))
      return
    }
    setErrors({})
    // Empty photo = no photo
    const body = { ...result.data, cast: result.data.cast.map((c) => (c.photoUrl ? c : { name: c.name })) }
    save.mutate(body, {
      onSuccess: () => {
        if (!id) navigate('/admin/movies', { state: { message: `"${body.title}" added.` } })
      },
      onError: (error) => setErrors(error.details ?? {}),
    })
  }

  function doDelete() {
    remove.mutate(undefined, {
      onSuccess: () => navigate('/admin/movies', { state: { message: `"${initial.title}" deleted.` } }),
    })
  }

  const serverError = save.error && !save.error.details ? save.error : null

  return (
    <div className="space-y-4">
      <p>
        <Link to="/admin/movies" className="font-type underline">
          ← All movies
        </Link>
      </p>
      <h1 className="font-heading text-3xl text-maroon dark:text-gold">{id ? 'Edit movie' : 'Add movie'}</h1>

      <Card>
        <form onSubmit={submit} noValidate className="space-y-6">
          <TextField label="Title" value={form.title} onChange={change('title')} error={errors.title} />

          <ImageUpload label="Poster" kind="poster" value={form.posterUrl} onChange={(url) => set('posterUrl', url)} error={errors.posterUrl} />

          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label="Duration (minutes)"
              inputMode="numeric"
              value={form.durationMinutes}
              onChange={change('durationMinutes')}
              error={errors.durationMinutes}
            />
            <SelectField
              label="Certificate"
              placeholder="Pick one"
              options={certificateOptions}
              value={form.certificate}
              onChange={change('certificate')}
              error={errors.certificate}
            />
            <TextField label="Release date" type="date" value={form.releaseDate} onChange={change('releaseDate')} error={errors.releaseDate} />
          </div>

          <SelectField label="Status" options={statusOptions} value={form.status} onChange={change('status')} error={errors.status} />

          <CheckboxGroup legend="Languages" options={LANGUAGES} value={form.languages} onChange={(v) => set('languages', v)} error={errors.languages} />
          <CheckboxGroup legend="Genres" options={GENRES} value={form.genres} onChange={(v) => set('genres', v)} error={errors.genres} />

          <TextField
            label="Trailer link (optional)"
            type="url"
            placeholder="https://"
            value={form.trailerUrl}
            onChange={change('trailerUrl')}
            error={errors.trailerUrl}
          />

          <fieldset className="space-y-3">
            <legend className="font-type">Cast (optional)</legend>
            {form.cast.map((person, index) => (
              <div key={index} className="space-y-3 rounded-card border border-ink p-3">
                <TextField
                  label={`Name ${index + 1}`}
                  value={person.name}
                  onChange={(e) => setCast(index, { name: e.target.value })}
                  error={errors[`cast.${index}.name`]}
                />
                <ImageUpload
                  label={`Photo ${index + 1}`}
                  kind="cast"
                  optional
                  previewClass="h-16 w-16"
                  value={person.photoUrl ?? ''}
                  onChange={(url) => setCast(index, { photoUrl: url || undefined })}
                />
                <Button variant="secondary" onClick={() => removeCast(index)}>
                  Remove {person.name || `person ${index + 1}`}
                </Button>
              </div>
            ))}
            {form.cast.length < 30 && (
              <Button variant="secondary" onClick={() => set('cast', [...form.cast, { name: '' }])}>
                + Add cast member
              </Button>
            )}
          </fieldset>

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
            {save.isPending ? 'Saving…' : id ? 'Save changes' : 'Add movie'}
          </Button>
        </form>
      </Card>

      {/* A-02: delete only when the movie has no shows and no bookings */}
      {id && (
        <Card>
          <h2 className="mb-2 font-type text-xl">Delete movie</h2>
          {inUse ? (
            <p>This movie has shows or bookings, so it cannot be deleted. Set the status to Inactive to hide it from users and owners.</p>
          ) : confirmDelete ? (
            <div className="space-y-3">
              <p role="alert">Delete &quot;{initial.title}&quot; for good?</p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={doDelete} disabled={remove.isPending}>
                  {remove.isPending ? 'Deleting…' : 'Yes, delete'}
                </Button>
                <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
              {remove.isError && <p className="font-bold text-(--tone-alert)">{remove.error.message}</p>}
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setConfirmDelete(true)}>
              Delete movie
            </Button>
          )}
        </Card>
      )}
    </div>
  )
}
