import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../components/Card'
import SectionTitle from '../components/SectionTitle'
import HomeLink from '../components/HomeLink'
import WelcomeSlide1 from './welcome/WelcomeSlide1'
import WelcomeSlide2 from './welcome/WelcomeSlide2'
import WelcomeSlide5 from './welcome/WelcomeSlide5'
import { usePets } from '../lib/PetsContext'
import { APP_FEATURE_LIST } from '../lib/appFeatures'

// Four panels: the three welcome slides and the feature list.
const PANEL_COUNT = 4

export default function About() {
  const { selectedPet } = usePets()
  const pet = selectedPet
  const carouselRef = useRef(null)
  const [panel, setPanel] = useState(0)

  // Which panel is in view, from the scroller itself rather than from a
  // slider's own idea of where it is — the two cannot disagree if there is
  // only one of them.
  function onScroll(event) {
    const el = event.currentTarget
    const step = el.scrollWidth / PANEL_COUNT
    setPanel(Math.min(PANEL_COUNT - 1, Math.max(0, Math.round(el.scrollLeft / step))))
  }

  function goToPanel(index) {
    const el = carouselRef.current
    if (!el) return
    el.scrollTo({ left: (el.scrollWidth / PANEL_COUNT) * index, behavior: 'smooth' })
  }

  return (
    <div className="screen">
      <HomeLink />

      {/* A carousel, swiped sideways, rather than four cards stacked down the
          screen — Ash's instruction 24 Sep 2026. These four ARE the welcome
          walkthrough, which is swiped; reading the same content by scrolling
          past it made it a different thing on this screen.

          Scroll-snap rather than a JavaScript slider: the native scroller
          keeps the platform's own momentum and rubber-banding, and works with
          a trackpad and a screen reader's own navigation without any of it
          being rebuilt. */}
      <div className="about-carousel" ref={carouselRef} onScroll={onScroll}>
      <Card>
        <WelcomeSlide1 petName={pet?.name} />
      </Card>

      <Card>
        <WelcomeSlide2 />
      </Card>

      <Card>
        {/* "App Features" — APPROVED — Dr Ash Cullen (BSc, DVM), 24 Sep 2026.

            Read, not tapped — Ash's instruction 24 Sep 2026. These rows were
            links, which made a page about what the app IS into a second
            navigation menu, and tapping a paid one from here landed a free
            account on a paywall it had not asked for. Same treatment as the
            signup walkthrough now, including the Premium tags: somebody
            reading about the app should see everything it does and which
            parts are paid, rather than discovering the difference by being
            stopped. */}
        <SectionTitle>App Features</SectionTitle>
        <div className="welcome-help-list">
          {APP_FEATURE_LIST.map(({ Icon, label, premium }) => (
            <div key={label} className="welcome-help-row">
              <span className="icon-badge">
                <Icon size={20} color="#fff" />
              </span>
              <span>
                {label}
                {premium && <span className="premium-tag welcome-help-premium">Premium</span>}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <WelcomeSlide5 />
      </Card>
      </div>

      {/* Dots, so it is obvious there is more than one panel — Ash's
          instruction 24 Sep 2026. A carousel whose only clue is the sliver of
          the next card at the edge is a carousel most people never swipe.
          Tappable as well as readable: the dot is where a thumb goes when
          somebody has worked out what it means. */}
      <div className="carousel-dots">
        {Array.from({ length: PANEL_COUNT }, (_, index) => (
          <button
            key={index}
            type="button"
            className={`carousel-dot ${index === panel ? 'is-active' : ''}`.trim()}
            // Plain buttons with a current marker, not ARIA tabs: tabs
            // promise a tabpanel relationship that a scroller does not have,
            // and a screen reader following that promise finds nothing.
            aria-current={index === panel ? 'true' : undefined}
            aria-label={`Panel ${index + 1} of ${PANEL_COUNT}`}
            onClick={() => goToPanel(index)}
          />
        ))}
      </div>

      {/* The last thing on the screen now that the footer has gone. */}
      <div className="legal-links">
        <Link to="/terms" className="legal-link">Terms &amp; Conditions</Link>
        <Link to="/privacy" className="legal-link">Privacy Policy</Link>
      </div>

    </div>
  )
}
