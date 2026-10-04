// Button looks (UI-05: 6 px corners). Touch target at least 44 px high (16.8).
// Shared by <Button> and <ButtonLink>, so a link can look like a button.
//   primary   maroon button (main action)
//   secondary outline: ink on light paper, cream on the Night show page (--outline in theme.css)
//   light     cream outline, for dark wood / ink surfaces (sidebar, staff bar)
//   gold      gold button on maroon (marquee banner "Book tickets", UI-15)
const looks = {
  primary: 'bg-maroon text-cream hover:bg-maroon/90',
  secondary: 'border border-(--outline) bg-transparent text-(--outline) hover:bg-(--outline-hover)',
  light: 'border border-cream bg-transparent text-cream hover:bg-stage',
  gold: 'bg-gold text-ink font-bold hover:bg-gold/90 focus:outline-cream',
}

export function buttonClass(variant = 'primary', className = '') {
  return `inline-flex min-h-11 items-center justify-center rounded-btn px-5 py-2 font-type focus:outline-2 focus:outline-offset-2 focus:outline-maroon disabled:opacity-60 ${looks[variant]} ${className}`
}
