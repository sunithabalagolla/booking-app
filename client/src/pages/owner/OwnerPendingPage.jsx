import { Navigate } from 'react-router'
import { useLogout } from '../../api/auth.js'
import Button from '../../components/ui/Button.jsx'
import PaperCard from '../../components/ui/PaperCard.jsx'
import { needsApproval, useAuthStore } from '../../store/authStore.js'

// O-01: a logged-in owner who is not approved yet (ROLE-03) waits here.
// Rejected owners see the admin's reason (A-03).
export default function OwnerPendingPage() {
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()

  if (status === 'loading') return null
  if (status === 'guest') return <Navigate to="/login" state={{ from: '/owner/pending' }} replace />
  // Not an owner, or already approved: nothing to wait for
  if (!needsApproval(user)) return <Navigate to="/" replace />

  const rejected = user.owner?.approvalStatus === 'rejected'

  return (
    <PaperCard title={rejected ? 'Owner account not approved' : 'Waiting for approval'}>
      <div className="space-y-4">
        <p className="py-2">
          {/* UI-30 stamp colours: Pending = dark mustard, Rejected = maroon */}
          <span className={`stamp text-xl ${rejected ? 'text-maroon' : 'text-mustard'}`}>
            {rejected ? 'Rejected' : 'Pending'}
          </span>
        </p>
        <p>
          <strong>{user.owner?.businessName}</strong>
        </p>
        {rejected ? (
          <>
            <p role="status">An admin did not approve your owner account.</p>
            {user.owner?.rejectReason && (
              <p>
                Reason: <span className="font-type">{user.owner.rejectReason}</span>
              </p>
            )}
          </>
        ) : (
          <p role="status">
            Your owner account is waiting for admin approval. You can add theatres after it is approved. We will send you
            an email.
          </p>
        )}
        <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
          Log out
        </Button>
      </div>
    </PaperCard>
  )
}
