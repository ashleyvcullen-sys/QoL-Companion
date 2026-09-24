import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import Btn from './Btn'

// The square the photo is cropped to, in pixels, and the size of the window
// it is framed in on screen.
const OUTPUT_PX = 512
const MAX_ZOOM = 4

// Position and crop a photo before it becomes the pet's picture — Ash's
// instruction 24 Sep 2026.
//
// Drag to move, pinch or drag the slider to zoom, exactly as the photo apps
// people already use behave. The frame is round because the avatar is round:
// cropping to a square and discovering afterwards that the circle cut the
// dog's ears off is the thing this exists to prevent.
//
// The transform on screen and the crop written to the canvas are the SAME
// numbers — offset and zoom — rather than two calculations that have to agree.
export default function PetPhotoCropper({ file, onCancel, onConfirm }) {
  const [url, setUrl] = useState(null)
  const [image, setImage] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const frameRef = useRef(null)
  const dragRef = useRef(null)
  const pinchRef = useRef(null)

  useEffect(() => {
    if (!file) return undefined
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    const loader = new Image()
    loader.onload = () => setImage({ width: loader.naturalWidth, height: loader.naturalHeight })
    loader.onerror = () => setError('That photo could not be opened.')
    loader.src = objectUrl
    // Revoked when the cropper closes, not before: the <img> on screen is
    // still pointing at it.
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  const frame = frameRef.current?.clientWidth ?? 280
  // "Cover": the smaller edge fills the frame, so there is never a gap.
  const base = image ? frame / Math.min(image.width, image.height) : 1
  const shownWidth = image ? image.width * base * zoom : 0
  const shownHeight = image ? image.height * base * zoom : 0

  // The photo may not be dragged off the frame — the crop must always be
  // entirely inside the picture.
  function clamp(next, width = shownWidth, height = shownHeight) {
    return {
      x: Math.min(0, Math.max(frame - width, next.x)),
      y: Math.min(0, Math.max(frame - height, next.y)),
    }
  }

  useEffect(() => {
    if (!image) return
    // Centred to begin with, which is what somebody who does nothing at all
    // will expect.
    setOffset({ x: (frame - image.width * base) / 2, y: (frame - image.height * base) / 2 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image])

  function distanceBetween(touches) {
    const [a, b] = touches
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  }

  // Zoom about the CENTRE of the frame, not its top-left corner. Growing from
  // the corner walks whatever the owner was looking at off the bottom-right
  // of the window, which is the opposite of what a zoom control is for.
  function applyZoom(next) {
    const centre = frame / 2
    const ratio = next / zoom
    setZoom(next)
    setOffset((current) => clamp(
      { x: centre - (centre - current.x) * ratio, y: centre - (centre - current.y) * ratio },
      image.width * base * next,
      image.height * base * next,
    ))
  }

  // Pointer events, with capture, so a drag that leaves the frame keeps
  // working. Mouse handlers on the element alone gave up the moment the
  // cursor crossed the edge — which is exactly when somebody is dragging the
  // far side of a photo into view.
  function onPointerDown(event) {
    if (pinchRef.current) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = { x: event.clientX - offset.x, y: event.clientY - offset.y }
  }

  function onPointerMove(event) {
    if (!dragRef.current || pinchRef.current) return
    setOffset(clamp({ x: event.clientX - dragRef.current.x, y: event.clientY - dragRef.current.y }))
  }

  function onPointerUp(event) {
    dragRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  // Two fingers are a pinch, and only a pinch: the drag above is already
  // handling one.
  function onTouchStart(event) {
    if (event.touches.length !== 2) return
    pinchRef.current = { distance: distanceBetween(event.touches), zoom }
    dragRef.current = null
  }

  function onTouchMove(event) {
    if (!pinchRef.current || event.touches.length !== 2) return
    const ratio = distanceBetween(event.touches) / pinchRef.current.distance
    applyZoom(Math.min(MAX_ZOOM, Math.max(1, pinchRef.current.zoom * ratio)))
  }

  function onTouchEnd(event) {
    if (event.touches.length < 2) pinchRef.current = null
  }

  async function confirm() {
    if (!image || busy) return
    setBusy(true)
    setError('')
    try {
      const source = await createImageBitmap(file)
      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_PX
      canvas.height = OUTPUT_PX

      // Back out of the on-screen transform: what the frame is showing is the
      // rectangle starting at -offset, one frame wide, in image pixels.
      const pixelsPerCssPx = 1 / (base * zoom)
      const sx = -offset.x * pixelsPerCssPx
      const sy = -offset.y * pixelsPerCssPx
      const size = frame * pixelsPerCssPx

      canvas.getContext('2d').drawImage(source, sx, sy, size, size, 0, 0, OUTPUT_PX, OUTPUT_PX)
      source.close?.()

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
      if (!blob) throw new Error('That photo could not be saved.')
      await onConfirm(blob)
    } catch (cropError) {
      setError(cropError.message || 'That photo could not be saved.')
      setBusy(false)
    }
  }

  return (
    /* APPROVED — Dr Ash Cullen (BSc, DVM), 24 Sep 2026. The title, the hint and the two buttons. */
    <Modal title="Position the Photo" onClose={busy ? () => {} : onCancel}>
      <div
        className="cropper-frame"
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {url && (
          <img
            src={url}
            alt=""
            className="cropper-image"
            draggable="false"
            style={{
              width: shownWidth || undefined,
              height: shownHeight || undefined,
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
          />
        )}
        {/* The circle the avatar will actually show, drawn over the square so
            nothing has to be imagined. */}
        <span className="cropper-mask" aria-hidden="true" />
      </div>

      <label className="cropper-zoom">
        <span className="field-label">Zoom</span>
        <input
          type="range"
          min="1"
          max={MAX_ZOOM}
          step="0.01"
          value={zoom}
          onChange={(event) => applyZoom(Number(event.target.value))}
        />
      </label>

      <p className="assessment-hint cropper-hint">Drag the photo to move it. Pinch or use the slider to zoom.</p>

      {error && <p className="form-error">{error}</p>}

      <div className="cropper-actions">
        <Btn type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Btn>
        <Btn type="button" onClick={confirm} disabled={busy || !image}>
          {busy ? 'Saving…' : 'Use Photo'}
        </Btn>
      </div>
    </Modal>
  )
}
