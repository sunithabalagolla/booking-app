import { useLocation } from 'react-router'
import PaperCard from '../../components/ui/PaperCard.jsx'
import ResendVerify from '../../components/ui/ResendVerify.jsx'

// U-01: shown after sign up. The email comes from the sign up page (router state).
export default function CheckEmailPage() {
  const email = useLocation().state?.email

  return (
    <PaperCard title="Check your email">
      <div className="space-y-4">
        <p>
          We sent a verify link to {email ? <strong>{email}</strong> : 'your email'}. Please open it within 24 hours to
          start booking your seats.
        </p>
        <p className="text-sm">No email? Look in the spam folder, or ask for a new link.</p>
        <ResendVerify knownEmail={email} />
      </div>
    </PaperCard>
  )
}
