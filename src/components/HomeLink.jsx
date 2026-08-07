import { Link } from 'react-router-dom'

export default function HomeLink({ className = '' }) {
  return (
    <Link to="/" className={`home-link ${className}`.trim()}>
      🏠 Home
    </Link>
  )
}
