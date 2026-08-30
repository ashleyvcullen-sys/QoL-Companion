import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { usePets } from '../lib/PetsContext'

// Horizontal row of the account's pets, plus the control for adding one.
//
// Adding a pet lives here rather than as a home-screen tile because this IS
// the pet control — someone looking to add a second pet looks where they
// switch between them. It also means a one-off action stopped taking up a
// slot in a grid of things people use daily.
//
// Renders for single-pet accounts too, unlike before: the switcher chips are
// still hidden (a switcher with one option is noise), but the add control has
// to be reachable or a one-pet account can never become a two-pet account.
export default function PetSwitcher() {
  // visiblePets, not pets: a pet hidden by a lapsed subscription must not
  // appear as a switchable option. The database will not return its data
  // either, so selecting it would land on an empty screen.
  const { visiblePets, selectedPetId, selectPet } = usePets()

  return (
    <div className="pet-switcher" role="group" aria-label="Select pet">
      {visiblePets.length > 1 && visiblePets.map((pet) => (
        <button
          key={pet.id}
          type="button"
          className={`pet-switcher-option ${pet.id === selectedPetId ? 'selected' : ''}`.trim()}
          aria-pressed={pet.id === selectedPetId}
          onClick={() => selectPet(pet.id)}
        >
          {pet.name}
        </button>
      ))}

      {/* Plus-tier feature, currently ungated for testing. Gate on
          hasMultiPetAccess(customerInfo) when the products are live. */}
      <Link to="/onboarding" className="pet-switcher-add">
        <Plus size={14} /> Add a pet
      </Link>
    </div>
  )
}
