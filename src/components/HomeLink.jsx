import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

export default function HomeLink({ className = '' }) {
  return (
    <Link to="/" className={`home-link ${className}`.trim()}>
      <Home size={14} /> Home
    </Link>
  )
}
