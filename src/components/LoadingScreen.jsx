// The whole screen, while the app works out who is signed in and which pets
// they have.
//
// Ash's report 27 Sep 2026: on opening the app the word was "too far up on the
// left side of the screen to read in full". It was a bare <p> returned straight
// into #root — no screen wrapper, so nothing applied the safe-area inset and it
// sat under the status bar and the notch, jammed against the left edge.
//
// One component rather than the copies of `<p>Loading…</p>` that were scattered
// across App, Login, Onboarding and Welcome: the first thing anyone sees of the
// app should not depend on which file happened to return it.
export default function LoadingScreen() {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <p>Loading…</p>
    </div>
  )
}
