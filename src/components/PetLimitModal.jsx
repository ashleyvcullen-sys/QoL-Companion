import { useNavigate } from 'react-router-dom'
import Modal from './Modal'
import Btn from './Btn'
import { useEntitlements } from '../lib/EntitlementsContext'

// Shown instead of the add-a-pet form when the account is at its limit.
//
// Two different situations wear the same modal, and they need different
// words. A free user has somewhere to go, so this is an offer — and with one
// paid tier there is no choice to present, just the thing and what it does.
// A premium subscriber at five pets has nowhere to go: there is nothing
// above them to sell, and showing a subscriber an upgrade prompt that leads
// to the plan they are already paying for is the kind of thing that gets an
// app called deceptive, and rightly.
//
// The free copy avoids mentioning what happens to existing pets: nothing is
// being taken away here, and raising it would invent a worry the user does
// not have. The hidden-pets banner on Home covers the case where something
// actually is hidden.
export default function PetLimitModal({ onClose }) {
  const navigate = useNavigate()
  const { tier, petLimit } = useEntitlements()
  const hasPremium = tier !== 'free'

  if (hasPremium) {
    return (
      <Modal title="Pet limit reached" onClose={onClose}>
        <p>
          You can track up to {petLimit} pets on your current plan. To add another,
          remove a pet you no longer need to track.
        </p>
        <Btn type="button" className="btn-block" onClick={onClose}>Got it</Btn>
      </Modal>
    )
  }

  return (
    <Modal title="Add another pet" onClose={onClose}>
      <p>
        Add more pets with QoL Companion Premium — track every pet in your household
        in one place.
      </p>
      <Btn
        type="button"
        className="btn-block"
        onClick={() => {
          onClose()
          navigate('/paywall')
        }}
      >
        See plans
      </Btn>
      <button type="button" className="subtle-link modal-secondary-link" onClick={onClose}>
        Not now
      </button>
    </Modal>
  )
}
