import ButtonLink from '../../components/ui/ButtonLink.jsx'
import PaperCard from '../../components/ui/PaperCard.jsx'

// 404 with the UI-36 message. The full vintage error page comes in Phase 10.
export default function NotFoundPage() {
  return (
    <PaperCard title="Page not found">
      <div className="space-y-4">
        <p>This reel is missing from the projector room.</p>
        <ButtonLink to="/">Go to home</ButtonLink>
      </div>
    </PaperCard>
  )
}
