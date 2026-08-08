import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Heart, TrendingUp, Bell, HeartHandshake, FileDown, LogOut, PawPrint, Stethoscope } from 'lucide-react'
import { usePets } from '../lib/PetsContext'
import { supabase } from '../lib/supabase'
import { HOME_TOUR_MESSAGES } from '../lib/homeTourContent'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeTour from '../components/HomeTour'
import Modal from '../components/Modal'
import Btn from '../components/Btn'
import ComingSoonModal from '../components/ComingSoonModal'
import HomeCareTipsIcon from '../components/icons/HomeCareTipsIcon'
import AboutIcon from '../components/icons/AboutIcon'

const NAV_ITEMS = [
  { to: '/about', label: 'About', Icon: AboutIcon },
  { to: '/assessment', label: 'Quality Of Life Assessment', Icon: Heart },
  { to: '/trends', label: 'Trends', Icon: TrendingUp },
  { to: '/home-care-tips', label: 'Home Care Tips', Icon: HomeCareTipsIcon },
  { to: '/schedule', label: 'Schedule', Icon: Bell },
  { to: '/export-report', label: 'Export Report', Icon: FileDown },
  { to: '/end-of-life', label: 'End Of Life', Icon: HeartHandshake },
  { to: '/emergencies', label: 'Emergencies', Icon: AlertTriangle },
]

export default function Home() {
  const { pets, refresh } = usePets()
  const pet = pets[0]
  const petName = pet?.name || 'your pet'
  const navigate = useNavigate()
  const location = useLocation()

  const [showTour, setShowTour] = useState(false)
  const autoTourShownRef = useRef(false)
  const tileRefs = useRef({})

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [showDiseaseMonitoringPreview, setShowDiseaseMonitoringPreview] = useState(false)

  const tourSteps = NAV_ITEMS.map(({ to, label }) => ({ to, label, message: HOME_TOUR_MESSAGES[to] }))

  useEffect(() => {
    console.log('[HomeTour] auto-show check:', {
      petId: pet?.id,
      petName: pet?.name,
      has_seen_app_tour: pet?.has_seen_app_tour,
      typeofFlag: typeof pet?.has_seen_app_tour,
      autoTourShownRefCurrent: autoTourShownRef.current,
    })
    if (pet && !pet.has_seen_app_tour && !autoTourShownRef.current) {
      autoTourShownRef.current = true
      setShowTour(true)
    }
  }, [pet])

  useEffect(() => {
    if (location.state?.startTour) {
      setShowTour(true)
      navigate('.', { replace: true, state: null })
    }
  }, [location.state, navigate])

  async function completeTour() {
    console.log('[HomeTour] completeTour called, pet before update:', pet?.id, pet?.has_seen_app_tour)
    setShowTour(false)
    if (pet && !pet.has_seen_app_tour) {
      const { data, error } = await supabase
        .from('pets')
        .update({ has_seen_app_tour: true })
        .eq('id', pet.id)
        .select()
      console.log('[HomeTour] update result:', { data, error })
      if (error) {
        // If this write silently fails (e.g. a missing UPDATE RLS policy on
        // `pets`), has_seen_app_tour never actually flips to true, and the
        // tour will auto-show again on every future visit to Home.
        console.error('Failed to mark app tour as seen:', error.message)
        return
      }
      await refresh()
      console.log('[HomeTour] refresh() finished')
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  async function handleDeletePet() {
    if (!pet || deleting) return
    setDeleting(true)
    setDeleteError('')

    const { error } = await supabase.from('pets').delete().eq('id', pet.id)

    if (error) {
      setDeleteError(error.message)
      setDeleting(false)
      return
    }

    setShowDeleteConfirm(false)
    setDeleting(false)
    // Deleting the last pet drops pets to an empty array, and the
    // RequireOnboardedPet route guard in App.jsx redirects to /onboarding
    // as soon as it sees pets.length === 0 — no manual navigate needed here.
    await refresh()
  }

  return (
    <div className="screen">
      <Card className="home-header">
        <img
          src="/images/logo.png"
          alt="Dog and cat, nose to nose, forming a heart"
          className="logo-placeholder"
        />
        <SectionTitle>{pet ? `${petName}'s Quality Of Life Companion` : 'Your Quality Of Life Companion'}</SectionTitle>
        <p className="home-subtitle">
          Here to support and help you navigate {petName}'s quality of life and wellbeing
          every step of the way.
        </p>
      </Card>

      <div className="icon-grid">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            ref={(el) => { tileRefs.current[to] = el }}
            className="icon-tile-link"
          >
            <Card className="icon-tile">
              <span className="icon-badge">
                <Icon size={22} strokeWidth={2} color="#fff" />
              </span>
              <span className="icon-tile-label">{label}</span>
            </Card>
          </Link>
        ))}

        <button
          type="button"
          className="icon-tile-link"
          onClick={() => setShowDiseaseMonitoringPreview(true)}
        >
          <Card className="icon-tile icon-tile-disabled">
            <span className="icon-badge icon-badge-disabled">
              <Stethoscope size={22} strokeWidth={2} color="#fff" />
            </span>
            <span className="icon-tile-label">Monitoring Specific Diseases</span>
            <span className="icon-tile-sublabel">Coming soon</span>
          </Card>
        </button>

        {/* TODO: multi-pet support isn't built yet — this tile is a placeholder,
            not a subscription gate. Replace with a real "add pet" flow once
            multi-pet support ships. */}
        <div className="icon-tile-link" style={{ cursor: 'default' }}>
          <Card className="icon-tile icon-tile-disabled">
            <span className="icon-badge icon-badge-disabled">
              <PawPrint size={22} strokeWidth={2} color="#fff" />
            </span>
            <span className="icon-tile-label">Add Another Pet</span>
            <span className="icon-tile-sublabel">Coming soon</span>
          </Card>
        </div>
      </div>

      <button type="button" className="sign-out-button" onClick={handleSignOut}>
        <LogOut size={14} /> Sign out
      </button>

      {pet && (
        <button
          type="button"
          className="delete-pet-link"
          onClick={() => setShowDeleteConfirm(true)}
        >
          Remove {petName}
        </button>
      )}

      {showTour && (
        <HomeTour steps={tourSteps} targetRefs={tileRefs} onFinish={completeTour} />
      )}

      {showDiseaseMonitoringPreview && (
        <ComingSoonModal
          title="Monitoring Specific Diseases"
          message="Specific quality-of-life tracking for diagnosed conditions like arthritis, cardiac disease, kidney disease, and more — coming soon."
          onClose={() => setShowDiseaseMonitoringPreview(false)}
        />
      )}

      {showDeleteConfirm && (
        <Modal
          title={`Delete ${petName}?`}
          onClose={() => (deleting ? null : setShowDeleteConfirm(false))}
        >
          <p>
            This will permanently delete {petName} and all their data. This cannot be undone.
          </p>
          {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
          <div className="modal-confirm-actions">
            <Btn type="button" variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
              Cancel
            </Btn>
            <Btn type="button" variant="danger" onClick={handleDeletePet} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
