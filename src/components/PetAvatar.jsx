import { useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import { cachedPetPhotoUrl, signPetPhoto, uploadPetPhoto } from '../lib/mediaData'
import { usePets } from '../lib/PetsContext'
import PetPhotoCropper from './PetPhotoCropper'

// The pet's face, where the brand mark used to be.
//
// Falls back to the logo whenever there is no photo, the signed URL fails, or
// the file has gone — a home screen must not depend on an image request
// succeeding. Read-only unless `editable`, which adds the way to set one.
export default function PetAvatar({ pet, size = 44, editable = false }) {
  const { refresh } = usePets()
  // Straight from the cache, before the first paint — Ash's report 24 Sep
  // 2026 that the photo does not come up immediately. Null only when there
  // genuinely is nothing to draw yet; see lib/mediaData.js.
  const [url, setUrl] = useState(() => cachedPetPhotoUrl(pet?.photo_path))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // The chosen file, waiting to be positioned. Cleared when the cropper
  // closes either way.
  const [pending, setPending] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const path = pet?.photo_path
    // Only blank it when there is nothing cached for the new path. Clearing
    // first was the flash: a photo already on screen was replaced by the
    // logo for the length of a round trip every time this remounted.
    const cached = cachedPetPhotoUrl(path)
    setUrl(cached)
    if (!path || cached) return undefined
    signPetPhoto(path).then((signed) => {
      if (!cancelled) setUrl(signed)
    })
    return () => { cancelled = true }
  }, [pet?.photo_path])

  // A cached URL that has expired, or been revoked, fails to load. Ask for a
  // fresh one once; if that fails too, the logo stands in as it always has.
  const retried = useRef(false)
  function onImageError() {
    if (retried.current || !pet?.photo_path) {
      setUrl(null)
      return
    }
    retried.current = true
    signPetPhoto(pet.photo_path, { force: true }).then(setUrl)
  }

  function onFile(event) {
    const file = event.target.files?.[0]
    // Clear it immediately: choosing the same file twice in a row fires no
    // change event otherwise.
    event.target.value = ''
    if (!file || !pet?.id) return
    setError('')
    // Straight into the cropper rather than straight to the server — a photo
    // taken in portrait is mostly floor, and a circle centred on the middle
    // of it is mostly floor too.
    setPending(file)
  }

  async function saveCropped(blob) {
    setBusy(true)
    try {
      await uploadPetPhoto({ petId: pet.id, file: blob, cropped: true })
      await refresh()
      setPending(null)
    } catch (uploadError) {
      setError(uploadError.message || 'That photo could not be saved.')
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  const image = url
    ? <img src={url} alt="" className="pet-avatar-image" onError={onImageError} />
    : <img src="/images/logo.png" alt="" className="pet-avatar-image pet-avatar-fallback" />

  if (!editable) {
    return <span className="pet-avatar" style={{ width: size, height: size }}>{image}</span>
  }

  return (
    <>
      <button
        type="button"
        className="pet-avatar is-editable"
        style={{ width: size, height: size }}
        aria-label={url ? `Change ${pet?.name ?? 'your pet'}'s photo` : `Add a photo of ${pet?.name ?? 'your pet'}`}
        onClick={() => fileRef.current?.click()}
        disabled={busy}
      >
        {image}
        {/* Only while there is no photo. It is an invitation to add one, not
            a permanent badge — once the pet's face is in the circle it is
            just something sitting on top of it. Ash's report, 24 Sep 2026.
            Changing the photo is still a tap on the circle, and the button's
            accessible name says so. */}
        {!url && (
          <span className="pet-avatar-badge" aria-hidden="true">
            <Camera size={11} strokeWidth={2.4} />
          </span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="visually-hidden"
        onChange={onFile}
      />
      {error && <p className="form-error pet-avatar-error">{error}</p>}

      {pending && (
        <PetPhotoCropper
          file={pending}
          onCancel={() => setPending(null)}
          onConfirm={saveCropped}
        />
      )}
    </>
  )
}
