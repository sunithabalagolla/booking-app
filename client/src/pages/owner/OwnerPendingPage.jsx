import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../api/client.js'
import Button from '../../components/ui/Button.jsx'
import PaperCard from '../../components/ui/PaperCard.jsx'
import Stamp from '../../components/ui/Stamp.jsx'
import { useAuthStore } from '../../store/authStore.js'

// O-01: a logged-in owner who is not approved yet (ROLE-03) waits here.
// Rejected owners see the admin's reason (A-03). Only they can open it (RoleRoute).
// A-03: the page loads the account again (on open and with "Check again"), so an
// approved owner goes straight to their register without logging in again.
export default function OwnerPendingPage() {
  const user = useAuthStore((s) => s.user)
  // Loads the account when the page opens; "Check again" loads it once more
  const me = useQuery({
    queryKey: ['me', 'approval'],
    queryFn: async () => {
      const { user: fresh } = await apiFetch('/me')
      useAuthStore.setState({ user: fresh }) // approved → RoleRoute sends them to /owner
      return fresh
    },
    refetchOnMount: 'always',
  })

  const rejected = user.owner?.approvalStatus === 'rejected'

  return (
    <PaperCard title={rejected ? 'Owner account not approved' : 'Waiting for approval'}>
      <div className="space-y-4">
        <p className="py-2">
          {/* UI-30 stamp colours: Pending = dark mustard (card version), Rejected = maroon */}
          <Stamp tone={rejected ? 'maroon' : 'mustard'} className="text-xl">
            {rejected ? 'Rejected' : 'Pending'}
          </Stamp>
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
        <Button variant="secondary" onClick={() => me.refetch()} disabled={me.isFetching}>
          {me.isFetching ? 'Checking…' : 'Check again'}
        </Button>
        {me.isError && (
          <p role="alert" className="text-sm font-bold text-(--tone-alert)">
            {me.error.message}
          </p>
        )}
      </div>
    </PaperCard>
  )
}
