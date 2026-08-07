import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Heart, TrendingUp, Bell, HeartHandshake, FileDown, LogOut } from 'lucide-react'
import { usePets } from '../lib/PetsContext'
import { supabase } from '../lib/supabase'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Btn from '../components/Btn'
import Modal from '../components/Modal'
import HomeCareTipsIcon from '../components/icons/HomeCareTipsIcon'
import AboutIcon from '../components/icons/AboutIcon'

const NAV_ITEMS = [
  { to: '/emergencies', label: 'Emergencies', Icon: AlertTriangle },
  { to: '/assessment', label: 'Quality Of Life Assessment', Icon: Heart },
  { to: '/trends', label: 'Trends', Icon: TrendingUp },
  { to: '/home-care-tips', label: 'Home Care Tips', Icon: HomeCareTipsIcon },
  { to: '/schedule', label: 'Schedule', Icon: Bell },
  { to: '/end-of-life', label: 'End Of Life', Icon: HeartHandshake },
  { to: '/export-report', label: 'Export Report', Icon: FileDown },
  { to: '/about', label: 'About', Icon: AboutIcon },
]

export default function Home() {
  const { pets, refresh } = usePets()
  const pet = pets[0]
  const petName = pet?.name || 'your pet'
  const navigate = useNavigate()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  async function handleDeletePet() {
    if (deleting || !pet) return
    setDeleting(true)
    setDeleteError('')

    const { error } = await supabase.from('pets').delete().eq('id', pet.id)

    if (error) {
      setDeleteError(error.message)
      setDeleting(false)
      return
    }

    const wasOnlyPet = pets.length === 1
    await refresh()
    setDeleting(false)
    setShowDeleteConfirm(false)
    navigate(wasOnlyPet ? '/onboarding' : '/')
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
          Track how {petName} is doing, day by day, and bring the trends to your vet.
        </p>
      </Card>

      <div className="icon-grid">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <Link key={to} to={to} className="icon-tile-link">
            <Card className="icon-tile">
              <span className="icon-badge">
                <Icon size={22} strokeWidth={2} color="#fff" />
              </span>
              <span className="icon-tile-label">{label}</span>
            </Card>
          </Link>
        ))}
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

      {showDeleteConfirm && (
        <Modal title="Remove pet?" onClose={() => !deleting && setShowDeleteConfirm(false)}>
          <p>
            This will permanently delete {petName} and all their data. This cannot be undone.
          </p>
          {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
          <div className="modal-actions">
            <Btn
              type="button"
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
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
