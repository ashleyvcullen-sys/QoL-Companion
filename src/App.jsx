import { useEffect } from 'react'
import { Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { useAuth } from './lib/AuthContext'
import { usePets } from './lib/PetsContext'
import Login from './screens/Login'
import Onboarding from './screens/Onboarding'
import Welcome from './screens/Welcome'
import Home from './screens/Home'
import QualityOfLifeAssessment from './screens/QualityOfLifeAssessment'
import Trends from './screens/Trends'
import Emergencies from './screens/Emergencies'
import EndOfLife from './screens/EndOfLife'
import HomeCareTips from './screens/HomeCareTips'
import Schedule from './screens/Schedule'
import ExportReport from './screens/ExportReport'
import About from './screens/About'
import Paywall from './screens/Paywall'
import Legal from './screens/Legal'
import Terms from './screens/Terms'
import Privacy from './screens/Privacy'
import Support from './screens/Support'
import StartupErrorScreen from './components/StartupErrorScreen'

function RequireOnboardedPet() {
  const { user, loading: authLoading, authError, retryAuth } = useAuth()
  const { pets, loading: petsLoading, petsError, refresh: retryPets, selectedPet } = usePets()

  // Checked before the loading states below — a failed or timed-out check
  // would otherwise leave authLoading/petsLoading permanently true, and the
  // user stuck on a bare "Loading…" forever with no way to recover.
  if (authError) {
    return <StartupErrorScreen message="We couldn't verify your login." detail={authError} onRetry={retryAuth} />
  }
  if (authLoading) return <p>Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  if (petsError) {
    return <StartupErrorScreen message="We couldn't load your pet's data." detail={petsError} onRetry={retryPets} />
  }
  if (petsLoading) return <p>Loading…</p>
  if (pets.length === 0) return <Navigate to="/onboarding" replace />
  // Scoped to the selected pet, not pets[0]. Pets added *after* the first
  // are created with has_seen_welcome already true (see Onboarding), so
  // adding a second pet never re-triggers the walkthrough — but if a pet
  // somehow does need it, it's the one actually being viewed that decides.
  if (!selectedPet.has_seen_welcome) return <Navigate to="/welcome" replace />

  return <Outlet />
}

function App() {
  const navigate = useNavigate()
  const { selectPet } = usePets()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const listenerPromise = LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (action) => {
        const extra = action.notification?.extra
        if (extra?.screen === 'assessment') {
          // Reminders are per-pet, so open the assessment for the pet the
          // notification was actually about rather than whichever pet
          // happened to be selected.
          if (extra.petId) selectPet(extra.petId)
          navigate('/assessment')
        }
      }
    )

    return () => {
      listenerPromise.then((listener) => listener.remove())
    }
  }, [navigate, selectPet])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/support" element={<Support />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route element={<RequireOnboardedPet />}>
        <Route path="/" element={<Home />} />
        <Route path="/assessment" element={<QualityOfLifeAssessment />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/emergencies" element={<Emergencies />} />
        <Route path="/end-of-life" element={<EndOfLife />} />
        <Route path="/home-care-tips" element={<HomeCareTips />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/export-report" element={<ExportReport />} />
        <Route path="/about" element={<About />} />
        <Route path="/paywall" element={<Paywall />} />
        <Route path="/legal" element={<Legal />} />
      </Route>
    </Routes>
  )
}

export default App
