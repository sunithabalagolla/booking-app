import { useState } from 'react'
import { useAdminSettings, useUpdateSettings } from '../../api/settings.js'
import Button from '../../components/ui/Button.jsx'
import Card from '../../components/ui/Card.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { formToChanges, hasTestValues, settingsToForm, SETTINGS_GROUPS, valueAt } from './settingsForm.js'

// A-05 Platform settings (UI-30 register look). Every change goes to the audit log.
export default function AdminSettingsPage() {
  const settings = useAdminSettings()

  if (settings.isError) {
    return (
      <p role="alert" className="font-bold text-(--tone-alert)">
        {settings.error.message}
      </p>
    )
  }
  if (!settings.data) return <p role="status">Loading…</p>
  return <SettingsForm settings={settings.data} />
}

function SettingsForm({ settings }) {
  const update = useUpdateSettings()
  const [form, setForm] = useState(() => settingsToForm(settings))
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState(null)

  function submit(e) {
    e.preventDefault()
    setMessage(null)
    const { body, errors: formErrors } = formToChanges(form, settings)
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }
    setErrors({})
    if (Object.keys(body).length === 0) {
      setMessage('Nothing changed.')
      return
    }
    update.mutate(body, {
      onSuccess: (data) => {
        setForm(settingsToForm(data.settings))
        setMessage(`Saved ${data.changed.length} ${data.changed.length === 1 ? 'setting' : 'settings'}. New values are used for new bookings only.`)
      },
      onError: (error) => setErrors(error.details ?? {}),
    })
  }

  const serverError = update.error && !update.error.details ? update.error : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl text-maroon dark:text-gold">Platform settings</h1>
        <p className="mt-1 font-type">Every change is saved in the audit log with the old and new value.</p>
      </div>

      {hasTestValues(settings) && (
        <p role="note" className="rounded-btn border-2 border-(--tone-mustard) p-3 font-type">
          These are TEST values from the seed script (made-up HSN / SAC codes and a sample company). Replace them with real values after asking a CA.
        </p>
      )}

      <form onSubmit={submit} noValidate className="space-y-6">
        {SETTINGS_GROUPS.map((group) => (
          <Card key={group.title} as="fieldset">
            <legend className="sr-only">{group.title}</legend>
            <h2 aria-hidden="true" className="mb-4 font-type text-xl">
              {group.title}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {group.fields.map((field) => {
                const notSet = field.needed && valueAt(settings, field.path) == null
                const hint = [field.unit && `In ${field.unit}.`, `Rule ${field.rule}.`, notSet && 'Not set yet: needed before bookings open.']
                  .filter(Boolean)
                  .join(' ')
                return (
                  <TextField
                    key={field.path}
                    label={field.label}
                    inputMode={field.type === 'text' ? undefined : 'decimal'}
                    value={form[field.path]}
                    onChange={(e) => setForm((f) => ({ ...f, [field.path]: e.target.value }))}
                    hint={hint}
                    error={errors[field.path]}
                  />
                )
              })}
            </div>
          </Card>
        ))}

        {serverError && (
          <p role="alert" className="font-bold text-(--tone-alert)">
            {serverError.message}
          </p>
        )}
        {Object.keys(errors).length > 0 && (
          <p role="alert" className="font-bold text-(--tone-alert)">
            Please check the marked fields.
          </p>
        )}
        <p role="status" className="font-type">
          {message}
        </p>

        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save settings'}
        </Button>
      </form>

      {/* Fixed list from the seed script; no admin screen for it (database.md 5.4) */}
      <Card>
        <h2 className="mb-2 font-type text-xl">Cities</h2>
        <p className="mb-3 text-sm">Fixed list, set by the seed script. Owners pick a theatre city from it.</p>
        {settings.cities.length === 0 ? (
          <p>No cities yet. Run the seed script (npm run seed).</p>
        ) : (
          <ul className="grid gap-1 sm:grid-cols-2">
            {settings.cities.map((city) => (
              <li key={city.code}>
                {city.name} <span className="text-sm">({city.state})</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
