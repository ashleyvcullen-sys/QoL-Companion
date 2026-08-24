import Modal from './Modal'
import Btn from './Btn'

export default function ComingSoonModal({ title, message, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{message}</p>
      <Btn type="button" className="btn-block" onClick={onClose}>Got it</Btn>
    </Modal>
  )
}
