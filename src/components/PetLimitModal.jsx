import { useNavigate } from 'react-router-dom'
import Modal from './Modal'
import Btn from './Btn'

// Shown instead of the add-a-pet form when the account is at its limit.
//
// An offer, not a refusal. The database will reject the insert anyway (see
// the pets INSERT policy), but "new row violates row-level security policy"
// is not a sentence to show a person, and neither is any polite rewording of
// a denial. Someone who has just tried to add a second pet has told us what
// they want; the useful reply is what it would take, not that they cannot.
//
// No mention of what happens to existing pets, deliberately: nothing is
// being taken away here, and raising the subject would invent a worry the
// user does not have. The hidden-pets banner on Home covers the case where
// something actually is hidden.
export default function PetLimitModal({ onClose }) {
  const navigate = useNavigate()

  return (
    <Modal title="Add another pet" onClose={onClose}>
      <p>
        Add more pets with QoL Companion Plus — track every pet in your household
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
