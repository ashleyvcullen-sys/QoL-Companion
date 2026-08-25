import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

// One photo or video, full size.
//
// The gallery crops every thumbnail to a square so the grid stays tidy, which
// means a portrait photo of a wound, a gait or a body condition — the reason
// most of these get taken — was only ever shown with its top and bottom cut
// off, and there was no way to see the rest of it. This is that way.
//
// Scaled to fit rather than cropped: the whole point is to see the whole
// picture.
export default function MediaLightbox({ items, index, urls, petName, onClose, onNavigate }) {
  const item = items[index]

  // Escape closes, arrows move. A phone has neither, but this screen is also
  // reachable in the browser build, and a full-screen overlay with no keyboard
  // way out is a trap there.
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
      if (event.key === 'ArrowRight' && index < items.length - 1) onNavigate(index + 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [index, items.length, onClose, onNavigate])

  // The page behind must not scroll while this is over it — on a phone,
  // dragging to pan the photo would otherwise scroll the gallery underneath.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  if (!item) return null

  const hasPrevious = index > 0
  const hasNext = index < items.length - 1

  return (
    <div className="lightbox-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close">
        <X size={22} />
      </button>

      {hasPrevious && (
        <button
          type="button"
          className="lightbox-nav previous"
          aria-label="Previous"
          onClick={(e) => { e.stopPropagation(); onNavigate(index - 1) }}
        >
          <ChevronLeft size={26} />
        </button>
      )}

      {/* Stops a tap on the photo itself from closing — only the surrounding
          dark area does that, which is what every photo viewer does and what
          a thumb reaching for a pinch-zoom expects. */}
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        {item.mediaType === 'video' ? (
          <video src={urls[item.storagePath]} controls autoPlay playsInline />
        ) : (
          <img src={urls[item.storagePath]} alt={item.caption || `Photo of ${petName}`} />
        )}

        {(item.caption || item.takenOn) && (
          <div className="lightbox-caption">
            {item.takenOn && <span className="lightbox-date">{formatDate(item.takenOn)}</span>}
            {item.caption && <span>{item.caption}</span>}
          </div>
        )}
      </div>

      {hasNext && (
        <button
          type="button"
          className="lightbox-nav next"
          aria-label="Next"
          onClick={(e) => { e.stopPropagation(); onNavigate(index + 1) }}
        >
          <ChevronRight size={26} />
        </button>
      )}

      {items.length > 1 && (
        <p className="lightbox-count">{index + 1} / {items.length}</p>
      )}
    </div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [year, month, day] = String(dateStr).split('-')
  return `${day}/${month}/${year}`
}
