import { useCallback, useEffect, useRef, useState } from 'react'

// Stale-while-revalidate, for the handful of queries every screen re-runs.
//
// Ash's report, 24 Sep 2026: moving around the app was not immediate. The
// zoom and the fade were part of it; this is the rest. Every screen loads its
// own data on mount, and React unmounts a screen the moment you leave it, so
// going Home → Trends → Home re-ran the same four queries and showed a
// skeleton each time — for rows that had not changed in the two seconds since
// they were last read.
//
// What this does: hand back the last answer immediately, then fetch again in
// the background and update if anything has changed. The screen is never
// blank on a second visit, and the data is never stale for longer than one
// round trip.
//
// Deliberately NOT a general query library. It caches by key, in memory, for
// the life of the session; there is no garbage collection because the keys are
// per pet and an owner has at most three.
const cache = new Map()
const inFlight = new Map()

// Everyone currently reading a key.
//
// Ash's report 27 Sep 2026: the dose dot on the Meds tab did not clear when
// the last dose was ticked off. The tab bar and the Medications screen each
// run their own useMedications, so the screen invalidated the key and
// refetched ITS copy while the bar went on showing the value it already held
// — and the bar never unmounts, so nothing ever corrected it.
//
// A cache that hands the same key to several readers has to tell all of them
// when that key goes stale, otherwise "one source of truth" is only true for
// whichever component did the writing.
const subscribers = new Map()

function notify(key) {
  const listeners = subscribers.get(key)
  if (!listeners) return
  // Copied, because a listener may unsubscribe while being called.
  for (const listener of [...listeners]) listener()
}

// Cleared when a pet's data is written, so the next read is honest. Callers
// use the `refresh` their hook already returns; this is the shared plumbing
// under it.
export function invalidateQuery(key) {
  cache.delete(key)
  inFlight.delete(key)
  notify(key)
}

// Every key under a prefix.
//
// A write that only knows a row id cannot name the pet whose cache it makes
// stale — unlogging a dose has a medication id and nothing else — and
// threading a pet id through every call site to serve the cache would be the
// cache leaking into the schema. An owner has at most a handful of pets, so
// clearing the whole family costs one extra round trip on a screen nobody is
// looking at.
export function invalidateQueryPrefix(prefix) {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
  for (const key of [...inFlight.keys()]) {
    if (key.startsWith(prefix)) inFlight.delete(key)
  }
  // Readers are told even where nothing was cached under their key yet: a
  // component mid-fetch still needs to know its answer is already out of date.
  for (const key of [...subscribers.keys()]) {
    if (key.startsWith(prefix)) notify(key)
  }
}

export function useCachedQuery(key, fetcher, { empty = null } = {}) {
  const [data, setData] = useState(() => (key ? cache.get(key) ?? empty : empty))
  // No spinner when there is something to show: a skeleton over data that is
  // already correct is a worse answer than the data.
  const [loading, setLoading] = useState(() => Boolean(key) && !cache.has(key))
  const [reloadToken, setReloadToken] = useState(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  // Whether this reader has ever had an answer. Not the same question as
  // "is the key cached": a refresh clears the cache and then re-fetches, and
  // in between there is still perfectly good data on the screen.
  const hasDataRef = useRef(Boolean(key) && cache.has(key))

  const refresh = useCallback(() => {
    if (key) invalidateQuery(key)
    setReloadToken((n) => n + 1)
  }, [key])

  // Re-read when anyone invalidates this key, not only when this component
  // asked for it. One request still goes out however many readers there are:
  // they all land on the same `inFlight` promise below.
  useEffect(() => {
    if (!key) return undefined
    const listener = () => setReloadToken((n) => n + 1)
    let listeners = subscribers.get(key)
    if (!listeners) {
      listeners = new Set()
      subscribers.set(key, listeners)
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) subscribers.delete(key)
    }
  }, [key])

  useEffect(() => {
    if (!key) {
      setData(empty)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    const cached = cache.get(key)
    if (cached !== undefined) {
      setData(cached)
      setLoading(false)
      hasDataRef.current = true
    } else if (!hasDataRef.current) {
      // Only where there is genuinely nothing to show. Ash's report
      // 27 Sep 2026 that toggling reminders "glitched": every write clears
      // the key, so the re-read found an empty cache and flipped this reader
      // back to loading — and the Medications screen swapped its list for a
      // skeleton for one round trip on every tap. Stale-while-revalidate is
      // the whole point of this cache; a refresh should show the old answer
      // until the new one lands, not a hole.
      setLoading(true)
    }

    // One request per key, however many screens ask at once — the home card
    // and the tab bar both want the same conditions.
    const request = inFlight.get(key) ?? fetcherRef.current()
      .then((result) => {
        cache.set(key, result)
        return result
      })
      .finally(() => inFlight.delete(key))
    inFlight.set(key, request)

    request
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setLoading(false)
          hasDataRef.current = true
        }
      })
      .catch((error) => {
        console.error(`Failed to load ${key}:`, error.message)
        if (!cancelled) {
          setData((current) => current ?? empty)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
    // `empty` is a literal at every call site, and re-running on a new array
    // identity would defeat the whole cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reloadToken])

  return { data, loading, refresh }
}
