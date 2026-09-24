import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HomeTour from '../components/HomeTour'
import { HOME_TOUR_MESSAGES } from './homeTourContent'
import { fillPetText } from './petText'
import { usePets } from './PetsContext'
import { supabase } from './supabase'

// The tour, and the screens it walks through.
//
// `target` is the tab the spotlight lands on; `show` is the screen behind it.
// The two differ for the assessment: its tab opens a wizard, and starting a
// half-finished check-in to describe one would be a strange way to introduce
// it — so that step is described from the home screen, where the owner
// already is. Ash's report, 24 Sep 2026: the background stayed on Home for
// every step, so the tour talked about screens it never showed.
const TOUR_STEPS = [
  // Home first — Ash's instruction 24 Sep 2026. The tour used to open on the
  // Assess tab, which is the second question: an owner standing on a screen
  // they have never seen wants to know what it is before being told how to
  // feed it.
  { target: '/', show: '/' },
  { target: '/assessment', show: '/' },
  { target: '/trends', show: '/trends' },
  { target: '/more', show: '/more' },
]

const TourContext = createContext(null)

export function useTour() {
  return useContext(TourContext) ?? { startTour: () => {} }
}

// Lives above the routes, not on the home screen, because the tour now walks
// between screens: mounted inside Home it would unmount the moment it
// navigated away from Home.
export function TourProvider({ children }) {
  const navigate = useNavigate()
  const { selectedPet: pet, refresh } = usePets()
  const [active, setActive] = useState(false)
  const autoShownRef = useRef(false)

  const startTour = useCallback(() => setActive(true), [])

  // A pet that has never seen it gets it once, automatically.
  useEffect(() => {
    if (pet && !pet.has_seen_app_tour && !autoShownRef.current) {
      autoShownRef.current = true
      setActive(true)
    }
  }, [pet])

  const steps = TOUR_STEPS.map((step) => ({
    ...step,
    // Filled here rather than in HomeTour: this is where the pet is, and the
    // tour component stays a renderer that takes finished strings.
    message: fillPetText(HOME_TOUR_MESSAGES[step.target], pet),
  }))

  async function finish() {
    setActive(false)
    // Back where it started, whichever screen the last step was showing.
    navigate('/')
    if (pet && !pet.has_seen_app_tour) {
      const { error } = await supabase
        .from('pets')
        .update({ has_seen_app_tour: true })
        .eq('id', pet.id)
        .select()
      if (error) {
        // If this write silently fails (e.g. a missing UPDATE RLS policy on
        // `pets`), has_seen_app_tour never actually flips to true, and the
        // tour will auto-show again on every future launch.
        console.error('Failed to mark app tour as seen:', error.message)
        return
      }
      await refresh()
    }
  }

  return (
    <TourContext.Provider value={{ startTour }}>
      {children}
      {active && pet && <HomeTour steps={steps} onFinish={finish} />}
    </TourContext.Provider>
  )
}
