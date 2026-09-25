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

// Cleared when a pet's data is written, so the next read is honest. Callers
// use the `refresh` their hook already returns; this is the shared plumbing
// under it.
export function invalidateQuery(key) {
  cache.delete(key)
  inFlight.delete(key)
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
}

export function useCachedQuery(key, fetcher, { empty = null } = {}) {
  const [data, setData] = useState(() => (key ? cache.get(key) ?? empty : empty))
  // No spinner when there is something to show: a skeleton over data that is
  // already correct is a worse answer than the data.
  const [loading, setLoading] = useState(() => Boolean(key) && !cache.has(key))
  const [reloadToken, setReloadToken] = useState(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const refresh = useCallback(() => {
    if (key) invalidateQuery(key)
    setReloadToken((n) => n + 1)
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
    } else {
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
