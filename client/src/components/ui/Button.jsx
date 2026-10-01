import { buttonClass } from './buttonStyles.js'

// Real <button>. Variants: primary (maroon), secondary (ink outline), light (on dark surfaces).
export default function Button({ className = '', variant = 'primary', ...props }) {
  return <button type="button" className={buttonClass(variant, className)} {...props} />
}
