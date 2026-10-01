import { Link } from 'react-router'
import { buttonClass } from './buttonStyles.js'

// A link that looks like a button (it goes to another page, so it stays a real link)
export default function ButtonLink({ className = '', variant = 'primary', ...props }) {
  return <Link className={buttonClass(variant, className)} {...props} />
}
