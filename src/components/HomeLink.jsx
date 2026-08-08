import { Link } from 'react-router-dom'
import { House } from 'lucide-react'

export default function HomeLink({ className = '' }) {
  return (
    <Link to="/" className={`home-link ${className}`.trim()}>
      <House size={14} />
      Home
    </Link>
  )
}
