import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { usePets } from '../lib/PetsContext'
import { supabase } from '../lib/supabase'
import Card from '../components/Card'
import SwipeableWizard from '../components/SwipeableWizard'
import StartupErrorScreen from '../components/StartupErrorScreen'
import WelcomeSlide1 from './welcome/WelcomeSlide1'
import WelcomeSlide2 from './welcome/WelcomeSlide2'
import WelcomeSlide3 from './welcome/WelcomeSlide3'
import WelcomeSlide4 from './welcome/WelcomeSlide4'
import WelcomeSlide5 from './welcome/WelcomeSlide5'

export default function Welcome() {
  const { user, loading: authLoading, authError, retryAuth } = useAuth()
  const { pets, loading: petsLoading, petsError, refresh } = usePets()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  if (authError) {
    return <StartupErrorScreen message="We couldn't verify your login." detail={authError} onRetry={retryAuth} />
  }
  if (authLoading) return <p>Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  if (petsError) {
    return <StartupErrorScreen message="We couldn't load your pet's data." detail={petsError} onRetry={refresh} />
  }
  if (petsLoading) return <p>Loading…</p>
  if (pets.length === 0) return <Navigate to="/onboarding" replace />

  const pet = pets[0]

  if (pet.has_seen_welcome) return <Navigate to="/" replace />

  async function handleComplete() {
    if (saving) return
    setSaving(true)
    setErrorMessage('')

    const { error } = await supabase
      .from('pets')
      .update({ has_seen_welcome: true })
      .eq('id', pet.id)

    if (error) {
      setErrorMessage(error.message)
      setSaving(false)
      return
    }

    await refresh()
    navigate('/')
  }

  const pages = [
    <WelcomeSlide1 key="slide-1" petName={pet.name} />,
    <WelcomeSlide2 key="slide-2" />,
    <WelcomeSlide3 key="slide-3" />,
    <WelcomeSlide4 key="slide-4" />,
    <WelcomeSlide5 key="slide-5" />,
  ]

  return (
    <div className="screen">
      <Card>
        <SwipeableWizard
          pages={pages}
          indicator="dots"
          finishLabel={saving ? 'Saving…' : 'Get Started'}
          onComplete={handleComplete}
        />
        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
      </Card>
    </div>
  )
}
