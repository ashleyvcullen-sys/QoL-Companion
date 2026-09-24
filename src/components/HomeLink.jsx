import { Link } from 'react-router-dom'
import { House } from 'lucide-react'
import { useTabBarVisible } from '../lib/useTabBar'

// The way back to the home screen, at the top of twenty screens.
//
// Sep 2026: silent wherever the bottom tab bar is on screen, since the Home
// tab is the same link, always in the same place, and two Home controls a
// thumb-length apart is a question ("do these do different things?") rather
// than a convenience. It still renders on the screens the bar stays off.
export default function HomeLink({ className = '' }) {
  const tabBarVisible = useTabBarVisible()

  if (tabBarVisible) return null

  return (
    <Link to="/" className={`home-link ${className}`.trim()}>
      <House size={14} />
      Home
    </Link>
  )
}
