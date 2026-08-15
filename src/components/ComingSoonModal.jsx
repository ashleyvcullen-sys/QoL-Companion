import { Link } from 'react-router-dom'
import Modal from './Modal'
import Btn from './Btn'

export default function ComingSoonModal({ title, message, onClose, showPlansLink = false }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{message}</p>
      <Btn type="button" className="btn-block" onClick={onClose}>Got it</Btn>
      {showPlansLink && (
        <Link to="/paywall" className="subtle-link modal-secondary-link" onClick={onClose}>
          See what's planned for premium
        </Link>
      )}
    </Modal>
  )
}
