import { useState } from 'react'
import { useAdminOwners, useApproveOwner, useBlockOwner, useRejectOwner, useUnblockOwner } from '../../api/adminOwners.js'
import Button from '../../components/ui/Button.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import TextField from '../../components/ui/TextField.jsx'
import { formatDay } from '../../validation/movies.js'
import { APPROVAL_LABELS, APPROVAL_TONES, ownerActions } from './ownerActions.js'

// A-03 Owner approvals: register table with Pending / Approved / Rejected / All tabs.
const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All' },
]

// createdAt (ISO, UTC) → its IST day → "2 Oct 2026" (BR-21)
const istDay = (iso) => new Date(new Date(iso).getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)

const cell = 'border border-ink px-3 py-2 align-top dark:border-cream-light'

export default function AdminOwnersPage() {
  const [status, setStatus] = useState('pending')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const owners = useAdminOwners({ status, q, page })
  const data = owners.data
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl text-maroon dark:text-gold">Owners</h1>

      <div className="flex flex-wrap items-end gap-4">
        <div role="group" aria-label="Show owners" className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <Button
              key={tab.label}
              variant={status === tab.value ? 'primary' : 'secondary'}
              aria-pressed={status === tab.value}
              onClick={() => {
                setStatus(tab.value)
                setPage(1)
              }}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <div className="min-w-60 flex-1">
          <TextField
            label="Search (start of name, email or business)"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      {owners.isError && (
        <p role="alert" className="font-bold text-(--tone-alert)">
          {owners.error.message}
        </p>
      )}
      {data && data.items.length === 0 && <p className="font-type">{status === 'pending' ? 'No owners are waiting.' : 'No owners found.'}</p>}

      {data && data.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-ink text-left dark:border-cream-light">
            <caption className="sr-only">Owners</caption>
            <thead className="font-type">
              <tr>
                {['Business', 'Owner', 'Signed up', 'Status', 'Actions'].map((h) => (
                  <th key={h} scope="col" className={cell}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((owner) => (
                <OwnerRow key={owner.id} owner={owner} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && pages > 1 && (
        <nav aria-label="Pages" className="flex items-center gap-4 font-type">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span>
            Page {data.page} of {pages}
          </span>
          <Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </nav>
      )}
    </div>
  )
}

function OwnerRow({ owner }) {
  const approve = useApproveOwner()
  const reject = useRejectOwner()
  const block = useBlockOwner()
  const unblock = useUnblockOwner()
  // Which small form is open in this row: 'reject' · 'block' · null
  const [open, setOpen] = useState(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState(null)

  const busy = approve.isPending || reject.isPending || block.isPending || unblock.isPending
  const error = [approve, reject, block, unblock].find((m) => m.isError)?.error
  const actions = ownerActions(owner)

  function sendReject() {
    if (reason.trim().length < 5) {
      setReasonError('Please give a reason (at least 5 characters).')
      return
    }
    setReasonError(null)
    reject.mutate({ id: owner.id, reason: reason.trim() }, { onError: (err) => setReasonError(err.details?.reason ?? null) })
  }

  return (
    <tr>
      <td className={cell}>
        <p className="font-type font-bold">{owner.businessName}</p>
        {owner.rejectReason && <p className="text-sm">Reason: {owner.rejectReason}</p>}
      </td>
      <td className={cell}>
        <p>{owner.name}</p>
        <p className="text-sm break-all">{owner.email}</p>
        <p className="text-sm">{owner.phone}</p>
        {!owner.emailVerified && (
          <p className="mt-1">
            <Stamp tone="mustard" className="text-xs">
              Email not verified
            </Stamp>
          </p>
        )}
      </td>
      <td className={`${cell} whitespace-nowrap`}>{formatDay(istDay(owner.createdAt))}</td>
      <td className={cell}>
        <Stamp tone={APPROVAL_TONES[owner.approvalStatus]} className="text-sm whitespace-nowrap">
          {APPROVAL_LABELS[owner.approvalStatus]}
        </Stamp>
        {owner.status === 'blocked' && (
          <p className="mt-2">
            <Stamp tone="maroon" className="text-sm">
              Blocked
            </Stamp>
          </p>
        )}
        {owner.decidedBy && <p className="mt-2 text-sm">by {owner.decidedBy.name}</p>}
      </td>
      <td className={cell}>
        <div className="flex flex-wrap gap-2">
          {actions.includes('approve') && (
            <Button onClick={() => approve.mutate({ id: owner.id })} disabled={busy}>
              {approve.isPending ? 'Approving…' : 'Approve'}
            </Button>
          )}
          {actions.includes('reject') && open !== 'reject' && (
            <Button variant="secondary" onClick={() => setOpen('reject')} disabled={busy}>
              Reject
            </Button>
          )}
          {actions.includes('block') && open !== 'block' && (
            <Button variant="secondary" onClick={() => setOpen('block')} disabled={busy}>
              Block
            </Button>
          )}
          {actions.includes('unblock') && (
            <Button variant="secondary" onClick={() => unblock.mutate({ id: owner.id })} disabled={busy}>
              {unblock.isPending ? 'Unblocking…' : 'Unblock'}
            </Button>
          )}
          {actions.length === 0 && <p className="text-sm">Waits for the email to be verified.</p>}
        </div>

        {open === 'reject' && (
          <div className="mt-3 space-y-2">
            <TextField label="Reason (sent to the owner)" value={reason} onChange={(e) => setReason(e.target.value)} error={reasonError} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={sendReject} disabled={busy}>
                {reject.isPending ? 'Rejecting…' : 'Reject owner'}
              </Button>
              <Button variant="secondary" onClick={() => setOpen(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {open === 'block' && (
          <div className="mt-3 space-y-2">
            <p className="text-sm">Blocking logs the owner and their Gate Staff out at once.</p>
            <TextField label="Reason (optional, for the audit log)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => block.mutate({ id: owner.id, reason: reason.trim() || undefined }, { onSuccess: () => setOpen(null) })}
                disabled={busy}
              >
                {block.isPending ? 'Blocking…' : 'Block owner'}
              </Button>
              <Button variant="secondary" onClick={() => setOpen(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {error && !reasonError && (
          <p role="alert" className="mt-2 text-sm font-bold text-(--tone-alert)">
            {error.message}
          </p>
        )}
      </td>
    </tr>
  )
}
