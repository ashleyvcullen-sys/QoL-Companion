import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTour } from '../lib/TourContext'
import PetSummaryCard from '../components/PetSummaryCard'
import Modal from '../components/Modal'
import Btn from '../components/Btn'
import { usePets } from '../lib/PetsContext'
import { dismissScoringChangeNotice, scoringChangeNoticeVisible } from '../lib/scoringChangeNotice'

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
  const { selectedPet } = usePets()
  // Why the numbers moved, once — see lib/scoringChangeNotice.js. Read on
  // mount, which also starts its one-day clock.
  const [scoringChange, setScoringChange] = useState(scoringChangeNoticeVisible)

  // "Take the Tour", from the More screen, arrives as navigation state.
  useEffect(() => {
    if (location.state?.startTour) {
      startTour()
      navigate('.', { replace: true, state: null })
    }
  }, [location.state, navigate, startTour])

  function closeScoringChange() {
    dismissScoringChangeNotice()
    setScoringChange(false)
  }

  return (
    <div className="screen">
      {/* How {name} actually is, and nothing in front of it. */}
      <PetSummaryCard />

      {/* APPROVED — Dr Ash Cullen (BSc, DVM), 24 Sep 2026. The sentence.
          PENDING ASH — the title.
          
          A dialogue rather than a line on the card: an owner whose history
          has just moved needs to be told once, plainly, and then left alone.
          It closes on OK and never returns; if they never press it, it stops
          appearing after a day anyway. */}
      {scoringChange && (
        <Modal title="Your score has changed" onClose={closeScoringChange}>
          <p>
            The overall score now takes disease monitoring and body condition into account
            as well as the assessment, so days you recorded earlier may read lower than
            they did. Nothing about {selectedPet?.name ?? 'your pet'} has changed.
          </p>
          <Btn type="button" className="btn-block" onClick={closeScoringChange}>OK</Btn>
        </Modal>
      )}
    </div>
  )
}
