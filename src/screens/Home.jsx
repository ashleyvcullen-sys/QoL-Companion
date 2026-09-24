import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTour } from '../lib/TourContext'
import PetSummaryCard from '../components/PetSummaryCard'

// The home screen is the summary card and nothing else.
//
// Sep 2026, with the bottom tab bar. It carried eleven tiles in two groups
// and a six-link footer bar under them, so the thing an owner opened the app
// to read — how their animal is today — shared the screen with a full menu
// of ways to go somewhere else. The daily destinations are now tabs, the
// rest are one tap away under More, and this screen answers its question.
//
// The tour lives above the routes now — lib/TourContext — because it walks
// between screens, and a tour mounted on Home unmounts itself the moment it
// leaves Home. This screen only asks for it.
export default function Home() {
  const navigate = useNavigate()
  const location = useLocation()
  const { startTour } = useTour()

  // "Take the Tour", from the More screen, arrives as navigation state.
  useEffect(() => {
    if (location.state?.startTour) {
      startTour()
      navigate('.', { replace: true, state: null })
    }
  }, [location.state, navigate, startTour])

  return (
    <div className="screen">
      {/* How {name} actually is, and nothing in front of it. */}
      <PetSummaryCard />
    </div>
  )
}
