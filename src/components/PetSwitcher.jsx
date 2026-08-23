import { usePets } from '../lib/PetsContext'

// Horizontal row of the account's pets, for switching which one the whole
// app is showing. Renders nothing for single-pet accounts — a "switcher"
// with one option is just noise, and this keeps the Home header identical
// to how it looked before multi-pet support for everyone who only has one.
export default function PetSwitcher() {
  const { pets, selectedPetId, selectPet } = usePets()

  if (pets.length < 2) return null

  return (
    <div className="pet-switcher" role="group" aria-label="Select pet">
      {pets.map((pet) => (
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
    </div>
  )
}
