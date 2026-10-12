import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { useMyStaff, useUpdateStaff } from '../../api/ownerStaff.js'
import Button from '../../components/ui/Button.jsx'
import ButtonLink from '../../components/ui/ButtonLink.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import { blockQuestion, STAFF_STATUS_LABELS, STAFF_STATUS_TONES } from '../../validation/staff.js'

// O-09: my Gate Staff logins (UI-30 register look). Block / unblock, no delete.
const cell = 'border border-ink px-3 py-2 align-top dark:border-cream-light'
const COLUMNS = ['Name', 'Email', 'Theatres', 'Status', 'Actions']

export default function OwnerStaffPage() {
  const location = useLocation()
  const staff = useMyStaff()
  const [confirmId, setConfirmId] = useState(null) // the row that asks "Block?" / "Unblock?"
  const [message, setMessage] = useState(location.state?.message ?? null)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl text-maroon dark:text-gold">Gate staff</h1>
        <ButtonLink to="/owner/staff/new">+ New staff</ButtonLink>
      </div>

      <p className="font-type">Staff log in with the email and password you give them. They can scan tickets only for the theatres you tick.</p>

      {message && (
        <p role="status" className="font-type">
          {message}
        </p>
      )}
      {staff.isError && (
        <p role="alert" className="font-bold text-(--tone-alert)">
          {staff.error.message}
        </p>
      )}
      {staff.isPending && <p role="status">Loading…</p>}

      {staff.data?.length === 0 && <p className="font-type">No gate staff yet. Add your first staff login.</p>}

      {staff.data?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-ink text-left dark:border-cream-light">
            <caption className="sr-only">My gate staff</caption>
            <thead className="font-type">
              <tr>
                {COLUMNS.map((h) => (
                  <th key={h} scope="col" className={cell}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.data.map((person) => (
                <Fragment key={person.id}>
                  <tr>
                    <td className={`${cell} font-type font-bold`}>{person.name}</td>
                    <td className={`${cell} break-all`}>{person.email}</td>
                    <td className={cell}>{person.theatres.map((t) => t.name).join(', ')}</td>
                    <td className={cell}>
                      <Stamp tone={STAFF_STATUS_TONES[person.status]} className="text-sm">
                        {STAFF_STATUS_LABELS[person.status]}
                      </Stamp>
                    </td>
                    <td className={cell}>
                      <div className="flex flex-wrap gap-2">
                        <ButtonLink variant="secondary" to={`/owner/staff/${person.id}`} aria-label={`Edit ${person.name}`}>
                          Edit
                        </ButtonLink>
                        <Button
                          variant="secondary"
                          aria-label={`${person.status === 'blocked' ? 'Unblock' : 'Block'} ${person.name}`}
                          onClick={() => {
                            setMessage(null)
                            setConfirmId(person.id)
                          }}
                        >
                          {person.status === 'blocked' ? 'Unblock' : 'Block'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {confirmId === person.id && (
                    <tr>
                      <td colSpan={COLUMNS.length} className={cell}>
                        <BlockPanel
                          person={person}
                          onClose={() => setConfirmId(null)}
                          onDone={(text) => {
                            setConfirmId(null)
                            setMessage(text)
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// "Block Raju?" panel under the row (like Cancel show, O-06)
function BlockPanel({ person, onClose, onDone }) {
  const update = useUpdateStaff()
  const headingRef = useRef(null)
  const id = useId()
  const question = blockQuestion(person)
  const blocking = person.status !== 'blocked'

  useEffect(() => headingRef.current?.focus(), []) // keyboard and screen reader users land on the panel

  function confirm() {
    update.mutate(
      { id: person.id, body: { status: blocking ? 'blocked' : 'active' } },
      { onSuccess: () => onDone(blocking ? `${person.name} is blocked and logged out.` : `${person.name} can log in again.`) },
    )
  }

  return (
    <section aria-labelledby={`${id}-title`} className="paper max-w-xl space-y-3 rounded-card border-2 border-maroon bg-cream p-4 text-ink">
      <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1} className="font-heading text-xl text-maroon">
        {question.title}
      </h2>
      <p className="font-type">{question.text}</p>
      {update.error && (
        <p role="alert" className="font-bold text-maroon">
          {update.error.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={confirm} disabled={update.isPending}>
          {update.isPending ? 'Saving…' : question.button}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          No
        </Button>
      </div>
    </section>
  )
}
