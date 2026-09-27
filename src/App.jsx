import { useEffect } from 'react'
import { Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { useAuth } from './lib/AuthContext'
import { usePets } from './lib/PetsContext'
import { useEntitlements } from './lib/EntitlementsContext'
import Login from './screens/Login'
import Onboarding from './screens/Onboarding'
import Welcome from './screens/Welcome'
import Home from './screens/Home'
import More from './screens/More'
import Assess from './screens/Assess'
import QualityOfLifeAssessment from './screens/QualityOfLifeAssessment'
import Trends from './screens/Trends'
import Emergencies from './screens/Emergencies'
import EndOfLife from './screens/EndOfLife'
import HomeCareTips from './screens/HomeCareTips'
import Schedule from './screens/Schedule'
import ExportReport from './screens/ExportReport'
import About from './screens/About'
import Settings from './screens/Settings'
import Paywall from './screens/Paywall'
import BodyConditionScore from './screens/BodyConditionScore'
import Medications from './screens/Medications'
import PetMedia from './screens/PetMedia'
import ConditionMonitoring from './screens/ConditionMonitoring'
import ConditionSetup from './screens/ConditionSetup'
import GastrointestinalSetup from './screens/GastrointestinalSetup'
import CancerContentReview from './screens/CancerContentReview'
import Conditions from './screens/Conditions'
import Legal from './screens/Legal'
import Terms from './screens/Terms'
import Privacy from './screens/Privacy'
import Support from './screens/Support'
import StartupErrorScreen from './components/StartupErrorScreen'
import TabBar from './components/TabBar'
import BackBar from './components/BackBar'
import ScrollManager from './components/ScrollManager'
import { ZoomProvider } from './components/ZoomTransition'
import { TourProvider } from './lib/TourContext'
import ScrollButtons from './components/ScrollButtons'
import { useReminderRehydration } from './lib/useReminderRehydration'
import { useHiddenPetReminderSync } from './lib/useHiddenPetReminderSync'
import { useOrphanReminderSweep } from './lib/useOrphanReminderSweep'
import LoadingScreen from './components/LoadingScreen'

function RequireOnboardedPet() {
  const { user, loading: authLoading, authError, retryAuth } = useAuth()
  const { pets, loading: petsLoading, petsError, refresh: retryPets, selectedPet } = usePets()

  // Checked before the loading states below — a failed or timed-out check
  // would otherwise leave authLoading/petsLoading permanently true, and the
  // user stuck on a bare "Loading…" forever with no way to recover.
  if (authError) {
    return <StartupErrorScreen message="We couldn't verify your login." detail={authError} onRetry={retryAuth} />
  }
  if (authLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (petsError) {
    return <StartupErrorScreen message="We couldn't load your pet's data." detail={petsError} onRetry={retryPets} />
  }
  if (petsLoading) return <LoadingScreen />
  if (pets.length === 0) return <Navigate to="/onboarding" replace />
  // Scoped to the selected pet, not pets[0]. Pets added *after* the first
  // are created with has_seen_welcome already true (see Onboarding), so
  // adding a second pet never re-triggers the walkthrough — but if a pet
  // somehow does need it, it's the one actually being viewed that decides.
  if (!selectedPet.has_seen_welcome) return <Navigate to="/welcome" replace />

  return <Outlet />
}

// Direct-URL guard for the premium routes.
//
// Locking the home-screen tiles stops the obvious route in, and the RLS
// policies stop the data coming out, but neither stops someone typing
// /medications, following a stale deep link, or restoring a tab. Without
// this they would reach a screen that renders, queries, and shows an empty
// state — which reads as "your medications are gone", not "this is a paid
// feature". Redirects to the paywall carrying the same feature phrase the
// tile would have sent.
function RequirePremium({ feature }) {
  const { hasPremium, loading } = useEntitlements()

  // Never decide while the entitlement is still loading: a subscriber would
  // be bounced to the paywall on every cold start.
  if (loading) return <LoadingScreen />
  if (!hasPremium) return <Navigate to="/paywall" replace state={{ feature }} />

  return <Outlet />
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const { selectPet } = usePets()

  // Re-arms medication reminders the OS has lost — after a reinstall,
  // a restore, or a new phone. No-op on a normal launch where everything is
  // still queued. Lives here rather than on the Medications screen because
  // the whole failure mode is the owner NOT visiting that screen: they trust
  // the reminders and only find out when a dose is missed.
  useReminderRehydration()

  // Cancels check-in reminders for pets a lapsed subscription has hidden,
  // and re-arms them on resubscribe. Same reasoning as above for living
  // here: the owner has no reason to visit any particular screen after a
  // subscription changes, and a reminder for a pet the app will not show
  // them is worse than no reminder at all.
  useHiddenPetReminderSync()

  // Cancels reminders that belong to nothing — a pet or an account deleted
  // outside the app, or armed by a build that predates the cleanup added on
  // 3 Sep 2026. Ash's report, 4 Sep 2026: a check-in fired for a pet on an
  // account she had already deleted.
  //
  // Here rather than on a screen because there is no screen to visit: the
  // account it belonged to cannot be signed into, and on a signed-out device
  // there is nothing but this.
  useOrphanReminderSweep()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const listenerPromise = LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (action) => {
        const extra = action.notification?.extra
        // Every reminder is per-pet, so switch to the pet the notification
        // was actually about before opening anything, rather than showing
        // whichever pet happened to be selected.
        if (extra?.petId) selectPet(extra.petId)

        if (extra?.screen === 'assessment') {
          navigate('/assessment')
        } else if (extra?.screen === 'condition' && extra.conditionKey) {
          navigate(`/conditions/${extra.conditionKey}`)
        } else if (extra?.screen === 'medications') {
          // Medication reminders have carried this since they were built and
          // nothing was listening for it, so tapping one opened the app to
          // wherever it was last left.
          navigate('/medications')
        }
      }
    )

    return () => {
      listenerPromise.then((listener) => listener.remove())
    }
  }, [navigate, selectPet])

  return (
    <ZoomProvider>
    <TourProvider>
    {/* Puts every screen at its top on arrival, and back where it was on the
        way out. */}
    <ScrollManager />

    {/* First in the column, so it takes its own space above whichever screen
        is rendered rather than floating over the top of it. */}
    <BackBar />

    {/* Keyed by PATH, not by history key: a screen that replaces its own
        navigation state (Home clearing the tour flag) must not remount
        itself. The fade covers the moment a newly mounted screen is still
        fetching, which is what read as a glitch when switching tabs. */}
    <div className="route-fade" key={location.pathname}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/support" element={<Support />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route element={<RequireOnboardedPet />}>
        <Route path="/" element={<Home />} />
        <Route path="/more" element={<More />} />
        {/* What to record, as a screen rather than a sheet — see Assess.jsx. */}
        <Route path="/assess" element={<Assess />} />
        <Route path="/assessment" element={<QualityOfLifeAssessment />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/emergencies" element={<Emergencies />} />
        <Route path="/end-of-life" element={<EndOfLife />} />
        <Route path="/home-care-tips" element={<HomeCareTips />} />
        <Route path="/schedule" element={<Schedule />} />
        {/* Premium since 24 Sep 2026 — Ash's instruction. The report is the
            thing an owner takes to the consult, and it is the clearest line
            between "I keep a diary" and "my vet can read it". */}
        <Route element={<RequirePremium feature="export" />}>
          <Route path="/export-report" element={<ExportReport />} />
        </Route>
        <Route path="/about" element={<About />} />
        {/* Inside RequireOnboardedPet with the rest: Account Management names the
            selected pet in "Remove {name}", so it has nothing coherent to
            show to an account that has not been through onboarding yet. */}
        <Route path="/settings" element={<Settings />} />
        <Route path="/paywall" element={<Paywall />} />
        <Route element={<RequirePremium feature="bcs" />}>
          <Route path="/body-condition" element={<BodyConditionScore />} />
        </Route>
        <Route element={<RequirePremium feature="medications" />}>
          <Route path="/medications" element={<Medications />} />
        </Route>
        <Route element={<RequirePremium feature="media" />}>
          <Route path="/media" element={<PetMedia />} />
        </Route>
        <Route element={<RequirePremium feature="conditions" />}>
          <Route path="/conditions" element={<Conditions />} />
        <Route path="/conditions/:conditionKey" element={<ConditionMonitoring />} />
        {/* Before the generic setup route. GI composes differently to cancer
            — no diagnosis layer, no per-instance measures — so it has its own
            screen rather than a branch inside one built around cancer's flow. */}
        <Route path="/conditions/gastrointestinal/setup" element={<GastrointestinalSetup />} />
        <Route path="/conditions/:conditionKey/setup" element={<ConditionSetup />} />
        {/* Unlinked. Reachable by URL only — see the note in the file. */}
        <Route path="/conditions/cancer/review" element={<CancerContentReview />} />
        </Route>
        <Route path="/legal" element={<Legal />} />
      </Route>
    </Routes>
    </div>

    {/* Outside <Routes> so it survives every navigation rather than being
        remounted by each screen, and so a screen cannot forget to render it.
        It decides for itself whether it belongs on the current route — see
        lib/useTabBar. */}
    <TabBar />
    <ScrollButtons />
    </TourProvider>
    </ZoomProvider>
  )
}

export default App
