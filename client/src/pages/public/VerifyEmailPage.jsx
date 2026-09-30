import { useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useVerifyEmail } from '../../api/auth.js'
import PaperCard from '../../components/ui/PaperCard.jsx'
import ResendVerify from '../../components/ui/ResendVerify.jsx'

// U-01: the link in the verify email opens this page: /verify-email?token=...
export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const verify = useVerifyEmail()
  const sent = useRef(false)

  useEffect(() => {
    // Send only once (React StrictMode runs effects twice in development)
    if (token && !sent.current) {
      sent.current = true
      verify.mutate(token)
    }
  }, [token, verify])

  if (!token || verify.isError) {
    return (
      <PaperCard title="This link does not work">
        <div className="space-y-4">
          <p role="alert">
            {verify.error?.code === 'NETWORK_ERROR'
              ? verify.error.message
              : 'The link has expired (it works for 24 hours) or was replaced by a newer one. Enter your email to get a new link.'}
          </p>
          <ResendVerify />
        </div>
      </PaperCard>
    )
  }

  if (verify.isSuccess) {
    return (
      <PaperCard title="Email verified">
        <div className="space-y-4">
          <p className="py-2">
            <span className="stamp text-xl text-green">Verified</span>
          </p>
          <p role="status">{verify.data.message}</p>
          {/* Login page comes with U-02 */}
          <Link to="/" className="inline-block min-h-11 rounded-btn bg-maroon px-5 py-2 font-type text-cream">
            Go to home
          </Link>
        </div>
      </PaperCard>
    )
  }

  return (
    <PaperCard title="Checking your link…">
      <p role="status">One moment, the projector is warming up.</p>
    </PaperCard>
  )
}
