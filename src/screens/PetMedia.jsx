import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Trash2, Upload } from 'lucide-react'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import Btn from '../components/Btn'
import HomeLink from '../components/HomeLink'
import Footer from '../components/Footer'
import MediaLightbox from '../components/MediaLightbox'
import { usePets } from '../lib/PetsContext'
import { formatDateDDMMYYYY } from '../lib/formatDate'
import {
  MAX_VIDEO_SECONDS,
  deleteMedia,
  mediaTypeFor,
  uploadMedia,
  usePetMedia,
} from '../lib/mediaData'

function todayIsoDate() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 10)
}


export default function PetMedia() {
  const { selectedPet } = usePets()
  const pet = selectedPet
  const { items, urls, loading, refresh } = usePetMedia(pet?.id)

  const fileInputRef = useRef(null)
  const [pending, setPending] = useState(null)
  const [caption, setCaption] = useState('')
  const [takenOn, setTakenOn] = useState(todayIsoDate())
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  // Which gallery item is open full size, as an index into `items`. Null is
  // closed. An index rather than the item itself, so the viewer can step
  // through the gallery without being handed the whole list twice.
  const [lightboxIndex, setLightboxIndex] = useState(null)

  // Where the owner came from, if a question sent them here for a photo.
  // Captured once so it survives an upload rather than being re-read from a
  // location that may have changed.
  const location = useLocation()
  const navigate = useNavigate()
  const [returnTo] = useState(() => location.state?.returnTo ?? null)
  const [returnLabel] = useState(() => location.state?.returnLabel ?? 'where you were')

  function handleFileChosen(event) {
    const file = event.target.files?.[0]
    // Reset immediately so picking the same file twice in a row still fires
    // a change event.
    event.target.value = ''
    if (!file) return

    if (!mediaTypeFor(file)) {
      setErrorMessage('That file type is not supported — photos and videos only.')
      return
    }

    setErrorMessage('')
    setPending(file)
    setCaption('')
    setTakenOn(todayIsoDate())
  }

  async function handleUpload() {
    if (!pending || busy) return
    setBusy(true)
    setErrorMessage('')
    try {
      await uploadMedia({ petId: pet.id, file: pending, caption, takenOn })
      setPending(null)
      setCaption('')
      refresh()
    } catch (error) {
      setErrorMessage(error.message || 'Could not upload that file.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(item) {
    setErrorMessage('')
    try {
      await deleteMedia(item)
      refresh()
    } catch (error) {
      setErrorMessage(error.message || 'Could not delete that file.')
    }
  }

  return (
    <div className="screen">
      <HomeLink />

      {/* The way back, for someone sent here from a question that asked for a
          photo. Read once on mount so it survives the uploads that follow —
          the same round trip Medications already offers. */}
      {returnTo && (
        <button type="button" className="subtle-link" onClick={() => navigate(returnTo)}>
          ← Back to {returnLabel}
        </button>
      )}

      <Card className="bcs-intro">
        <SectionTitle>Photos &amp; Videos</SectionTitle>
        <p>
          Keep a visual record of how {pet.name} is doing. A photo of a wound, a rash or their
          posture — or a short clip of how they're walking or breathing.
        </p>
        <p className="assessment-hint">
          A vet can often see more than you can describe — video especially, for gait,
          breathing effort, tremors or seizures.
        </p>
      </Card>

      <Card>
        <SectionTitle>Add</SectionTitle>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileChosen}
          style={{ display: 'none' }}
        />

        {!pending && (
          <>
            <Btn type="button" className="btn-block" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} /> Choose photo or video
            </Btn>
            <p className="assessment-hint">
              Photos are shrunk before upload to save space. Videos need to be under{' '}
              {MAX_VIDEO_SECONDS} seconds.
            </p>
          </>
        )}

        {pending && (
          <>
            <p className="assessment-hint">
              Selected: {pending.name || 'file'} ({(pending.size / 1024 / 1024).toFixed(1)}MB)
            </p>

            <div className="field">
              <label htmlFor="media-date">Date this shows</label>
              <input
                id="media-date"
                type="date"
                value={takenOn}
                max={todayIsoDate()}
                onChange={(e) => setTakenOn(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="media-caption">Caption (optional)</label>
              <input
                id="media-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="e.g. left hind leg, after the walk"
              />
            </div>

            <Btn type="button" className="btn-block" onClick={handleUpload} disabled={busy}>
              {busy ? 'Uploading…' : 'Upload'}
            </Btn>
            <button type="button" className="subtle-link" onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </button>
          </>
        )}

        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
      </Card>

      <Card>
        <SectionTitle>Gallery</SectionTitle>
        {loading && <p>Loading…</p>}
        {!loading && items.length === 0 && <p>Nothing added yet.</p>}

        <div className="media-grid">
          {items.map((item, index) => (
            <figure key={item.id} className="media-item">
              {/* A button, not a bare image. The grid crops every thumbnail
                  square, so a portrait photo is only ever partly visible here
                  — tapping opens the whole thing. A video keeps its own
                  controls in the grid and opens on the frame rather than the
                  play button, so tapping play does not also open the viewer. */}
              {item.mediaType === 'video' ? (
                <video src={urls[item.storagePath]} controls preload="metadata" playsInline />
              ) : (
                <button
                  type="button"
                  className="media-open"
                  onClick={() => setLightboxIndex(index)}
                  aria-label={`View ${item.caption || 'photo'} full size`}
                >
                  <img
                    src={urls[item.storagePath]}
                    alt={item.caption || `Photo of ${pet.name}`}
                    loading="lazy"
                  />
                </button>
              )}
              <figcaption>
                <span className="media-date">{formatDateDDMMYYYY(item.takenOn)}</span>
                {item.caption && <span className="assessment-hint">{item.caption}</span>}
              </figcaption>
              <button
                type="button"
                className="media-delete"
                aria-label="Delete this file"
                onClick={() => handleDelete(item)}
              >
                <Trash2 size={15} />
              </button>
            </figure>
          ))}
        </div>
      </Card>

      {lightboxIndex != null && (
        <MediaLightbox
          items={items}
          index={lightboxIndex}
          urls={urls}
          petName={pet.name}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}

      <Footer />
    </div>
  )
}
