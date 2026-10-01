import { useAuthStore } from '../../store/authStore.js'

// S-01: staff open straight here after login. No intro animation, ever (UI-10).
// The real scanner (S-02 to S-05, UI-31) comes in Phase 7; this is the frame for it.
// Only staff can open it (RoleRoute in router.jsx); the top bar is StaffLayout.
export default function StaffScanPage() {
  const user = useAuthStore((s) => s.user)

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
      {/* Old ticket window frame (UI-31): wooden border, cream window */}
      <section className="rounded-t-[999px] rounded-b-card border-8 border-wood bg-cream-light px-6 pt-16 pb-6 text-center text-ink">
        <h1 className="mb-4 font-heading text-2xl text-maroon">Gate scanner</h1>
        <p className="font-type">Namaste, {user.name}.</p>
        <p className="mt-2" role="status">
          The scanner comes in Phase 7 (S-02).
        </p>
      </section>
    </div>
  )
}
