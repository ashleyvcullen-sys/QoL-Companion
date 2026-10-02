import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { invalidateQueryPrefix, useCachedQuery } from './queryCache'

const MEDIA_EMPTY = []
const MEDIA_KEY_PREFIX = 'pet-media:'

// Cleared at the write, like every other table's cache. Deleting takes an
// item rather than a pet, so the family goes — see invalidateQueryPrefix.
function forgetMedia() {
  invalidateQueryPrefix(MEDIA_KEY_PREFIX)
}

// Said by the upload itself and by the screen that checks before calling it.
export const UNSUPPORTED_FILE_MESSAGE = 'That file type is not supported — photos and videos only.'

export const MEDIA_BUCKET = 'pet-media'
// The profile photo lives in its own private bucket, authorised by ownership
// alone — see 20260923000000_pet_photo.sql for why it is not in the one
// above.
export const PET_PHOTO_BUCKET = 'pet-photos'

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
  if (!mediaType) throw new Error(UNSUPPORTED_FILE_MESSAGE)

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

  // Cleared AFTER the write lands, never before — see the note in
  // conditionsData.js.
  forgetMedia()
}

export async function deleteMedia(item) {
  // Storage first: a failed row delete leaves a file the app still lists and
  // can retry on, whereas the reverse leaves a file nothing references.
  const { error: storageError } = await supabase.storage.from(MEDIA_BUCKET).remove([item.storagePath])
  if (storageError) throw storageError

  const { error } = await supabase.from('pet_media').delete().eq('id', item.id)
  if (error) throw error
  forgetMedia()
}

export function usePetMedia(petId) {
  // The list comes from the session cache, so a second visit to Photos &
  // Videos paints the grid immediately instead of showing a skeleton over
  // rows that have not changed.
  const { data, loading, refresh } = useCachedQuery(
    petId ? `${MEDIA_KEY_PREFIX}${petId}` : null,
    () => fetchMedia(petId),
    { empty: MEDIA_EMPTY },
  )
  const items = data ?? MEDIA_EMPTY
  const [urls, setUrls] = useState({})

  // The signatures are NOT cached with the list. They last an hour and a
  // session can outlast that, and a thumbnail that quietly 403s is worse than
  // one that appears a moment after the grid it sits in. So the list is what
  // makes the screen immediate; the pictures fill in behind it.
  useEffect(() => {
    if (items.length === 0) {
      setUrls({})
      return undefined
    }

    let cancelled = false
    signMediaUrls(items)
      .then((signed) => { if (!cancelled) setUrls(signed) })
      .catch((error) => { console.error('Failed to sign media URLs:', error.message) })

    return () => { cancelled = true }
  }, [items])

  return useMemo(
    () => ({ items, urls, loading, refresh }),
    [items, urls, loading, refresh],
  )
}

// --- The pet's profile photo -----------------------------------------------
//
// Ash's instruction 23 Sep 2026: the animal's own face on the home screen and
// in the pet switcher, in place of the brand mark. It identifies the record
// better than a logo does, and on a two-pet account it answers "which pet am
// I looking at?" before the name is read.
//
// Deliberately NOT a pet_media row, for two reasons. Photos & Videos is a
// paid feature and an identity element should not be: the path is kept on the
// pet itself, so a free account can set one without touching the gated table.
// And a profile photo is not part of the animal's record — it should not
// appear in the journal, in an export, or in a vet's report among the
// pictures of wounds.
//
// Its own private bucket, authorised by ownership rather than entitlement,
// following the same '<pet_id>/…' path convention.
export async function uploadPetPhoto({ petId, file, cropped = false }) {
  if (!cropped && mediaTypeFor(file) !== 'image') throw new Error('Please choose a photo.')

  // A cropped photo arrives as a square JPEG the cropper has already drawn at
  // the size it will be shown at, so there is nothing left to compress.
  const body = cropped ? file : await compressImage(file)
  const path = `${petId}/${crypto.randomUUID()}.jpg`

  const { error: uploadError } = await supabase
    .storage
    .from(PET_PHOTO_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg' })
  if (uploadError) throw uploadError

  // Read the old path BEFORE overwriting it, so the file it points at can be
  // removed once the new one is safely in place.
  const { data: before } = await supabase.from('pets').select('photo_path').eq('id', petId).maybeSingle()

  const { error } = await supabase.from('pets').update({ photo_path: path }).eq('id', petId)
  if (error) {
    // Orphaned object otherwise: nothing would ever point at it again.
    await supabase.storage.from(PET_PHOTO_BUCKET).remove([path]).catch(() => {})
    throw error
  }

  if (before?.photo_path && before.photo_path !== path) {
    await supabase.storage.from(PET_PHOTO_BUCKET).remove([before.photo_path]).catch(() => {})
  }

  return path
}

// --- The profile photo's signed URL, cached ---------------------------------
//
// Ash's report 24 Sep 2026: the pet's photo does not appear straight away on
// the home screen. It could not — every mount of PetAvatar asked Supabase to
// mint a fresh signed URL and drew the logo until the round trip came back,
// so the face arrived after the rest of the card, and again after every
// navigation back to Home.
//
// Two caches, for the two different waits:
//
//   In memory, so moving between screens in one session is instant.
//   In localStorage, so a cold start paints the face from the last run
//   instead of waiting for the network at all.
//
// A signed URL is good for an hour; both caches hold it for 55 minutes to
// leave a margin, and an expired or revoked one simply fails to load, which
// PetAvatar already handles by falling back to the logo.
const PHOTO_URL_TTL_MS = 55 * 60 * 1000
const photoUrlCache = new Map()
const photoStoreKey = (path) => `qol.petPhotoUrl.${path}`

function readStoredPhotoUrl(path) {
  try {
    const raw = window.localStorage.getItem(photoStoreKey(path))
    if (!raw) return null
    const entry = JSON.parse(raw)
    return entry?.url && entry.expires > Date.now() ? entry : null
  } catch {
    // Private mode, cleared site data, a value someone else wrote — all of
    // them mean "no cache", never "fail".
    return null
  }
}

function rememberPhotoUrl(path, url) {
  const entry = { url, expires: Date.now() + PHOTO_URL_TTL_MS }
  photoUrlCache.set(path, entry)
  try {
    window.localStorage.setItem(photoStoreKey(path), JSON.stringify(entry))
    // A pet's photo_path changes every time the photo does, so an old key
    // would otherwise sit in storage for ever. Dropped on the way past.
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i)
      if (!key?.startsWith('qol.petPhotoUrl.') || key === photoStoreKey(path)) continue
      const kept = JSON.parse(window.localStorage.getItem(key) || 'null')
      if (!kept?.expires || kept.expires <= Date.now()) window.localStorage.removeItem(key)
    }
  } catch {
    // Storage full or unavailable: the in-memory cache still works.
  }
}

// The URL to draw RIGHT NOW, without waiting for anything. Null when there is
// nothing cached, in which case signPetPhoto fetches one.
export function cachedPetPhotoUrl(path) {
  if (!path) return null
  const live = photoUrlCache.get(path)
  if (live && live.expires > Date.now()) return live.url
  const stored = readStoredPhotoUrl(path)
  if (stored) {
    photoUrlCache.set(path, stored)
    return stored.url
  }
  return null
}

// One signed URL, for one profile photo. An hour, like the gallery's.
//
// Returns the cached URL without a request when there is a live one, unless
// `force` — which is how a failed image asks for a fresh URL rather than the
// stale one that just failed.
export async function signPetPhoto(path, { force = false } = {}) {
  if (!path) return null
  if (!force) {
    const cached = cachedPetPhotoUrl(path)
    if (cached) return cached
  }
  const { data, error } = await supabase
    .storage
    .from(PET_PHOTO_BUCKET)
    .createSignedUrl(path, 60 * 60)
  if (error) {
    // A missing or unreadable photo is not worth an error on the home
    // screen — the logo stands in, exactly as it does for a pet with none.
    console.error('Could not load that pet photo:', error.message)
    return null
  }
  const url = data?.signedUrl ?? null
  if (url) rememberPhotoUrl(path, url)
  return url
}
