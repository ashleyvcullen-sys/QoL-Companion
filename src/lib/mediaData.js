import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export const MEDIA_BUCKET = 'pet-media'

// Videos are the expensive thing here — a minute of phone video can outweigh
// a thousand compressed photos, and every megabyte is storage you pay for
// and bandwidth the owner spends on mobile data. Capped rather than
// transcoded: re-encoding video in a webview is slow, battery-hungry and
// unreliable, so it's kinder to refuse a huge file with a clear message than
// to grind for two minutes and maybe fail.
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
export const MAX_VIDEO_SECONDS = 60

// Images ARE re-encoded, because that's cheap and the saving is enormous —
// a 12MP phone photo is ~4MB and carries far more detail than anyone needs
// to see a wound or a posture on a phone screen.
const IMAGE_MAX_EDGE = 1600
const IMAGE_QUALITY = 0.82

function extensionFor(file, mediaType) {
  const fromName = file.name?.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName
  return mediaType === 'video' ? 'mp4' : 'jpg'
}

export function mediaTypeFor(file) {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('image/')) return 'image'
  return null
}

// Reads duration without uploading, so an over-long clip is refused before
// the owner spends their data on it.
export function readVideoDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(video.duration) ? video.duration : null)
    }
    // A codec the browser can't parse gives no duration — allow it through
    // and let the size cap be the backstop rather than blocking a valid file.
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    video.src = url
  })
}

async function compressImage(file) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', IMAGE_QUALITY))
  // If the browser refuses to encode, fall back to the original rather than
  // losing the upload entirely.
  return blob ?? file
}

function mapMediaRow(row) {
  return {
    id: row.id,
    petId: row.pet_id,
    storagePath: row.storage_path,
    mediaType: row.media_type,
    caption: row.caption,
    takenOn: row.taken_on,
    bytes: row.bytes,
  }
}

export async function fetchMedia(petId) {
  const { data, error } = await supabase
    .from('pet_media')
    .select('*')
    .eq('pet_id', petId)
    .order('taken_on', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map(mapMediaRow)
}

// The bucket is private, so nothing renders without a signed URL. One hour is
// long enough to browse a gallery and short enough that a leaked link is not
// a lasting exposure.
export async function signMediaUrls(items) {
  if (items.length === 0) return {}
  const { data, error } = await supabase
    .storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(items.map((item) => item.storagePath), 60 * 60)

  if (error) throw error
  const byPath = {}
  for (const entry of data ?? []) {
    if (entry.signedUrl) byPath[entry.path] = entry.signedUrl
  }
  return byPath
}

export async function uploadMedia({ petId, file, caption, takenOn }) {
  const mediaType = mediaTypeFor(file)
  if (!mediaType) throw new Error('That file type is not supported — photos and videos only.')

  if (mediaType === 'video') {
    if (file.size > MAX_VIDEO_BYTES) {
      throw new Error(`That video is ${(file.size / 1024 / 1024).toFixed(0)}MB. Please keep videos under ${MAX_VIDEO_BYTES / 1024 / 1024}MB.`)
    }
    const duration = await readVideoDuration(file)
    if (duration != null && duration > MAX_VIDEO_SECONDS) {
      throw new Error(`That video is ${Math.round(duration)} seconds. Please keep videos under ${MAX_VIDEO_SECONDS} seconds.`)
    }
  }

  const body = mediaType === 'image' ? await compressImage(file) : file
  // crypto.randomUUID rather than the filename: two photos from the same
  // camera roll can share a name, and a user-supplied name in a storage path
  // is a needless place for surprises.
  const path = `${petId}/${crypto.randomUUID()}.${extensionFor(file, mediaType)}`

  const { error: uploadError } = await supabase
    .storage
    .from(MEDIA_BUCKET)
    .upload(path, body, { contentType: mediaType === 'image' ? 'image/jpeg' : file.type })

  if (uploadError) throw uploadError

  const { error } = await supabase.from('pet_media').insert({
    pet_id: petId,
    storage_path: path,
    media_type: mediaType,
    caption: caption || null,
    taken_on: takenOn,
    bytes: body.size ?? null,
  })

  // The row is what makes a file findable, so if it fails the object is
  // orphaned — remove it rather than quietly billing for something the app
  // can never show or delete.
  if (error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([path]).catch(() => {})
    throw error
  }
}

export async function deleteMedia(item) {
  // Storage first: a failed row delete leaves a file the app still lists and
  // can retry on, whereas the reverse leaves a file nothing references.
  const { error: storageError } = await supabase.storage.from(MEDIA_BUCKET).remove([item.storagePath])
  if (storageError) throw storageError

  const { error } = await supabase.from('pet_media').delete().eq('id', item.id)
  if (error) throw error
}

export function usePetMedia(petId) {
  const [items, setItems] = useState([])
  const [urls, setUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [reloadToken, setReloadToken] = useState(0)

  const refresh = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!petId) {
      setItems([])
      setUrls({})
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetchMedia(petId)
      .then(async (result) => {
        if (cancelled) return
        setItems(result)
        const signed = await signMediaUrls(result).catch(() => ({}))
        if (!cancelled) setUrls(signed)
      })
      .catch((error) => {
        console.error('Failed to load media:', error.message)
        if (cancelled) return
        setItems([])
        setUrls({})
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [petId, reloadToken])

  return { items, urls, loading, refresh }
}
