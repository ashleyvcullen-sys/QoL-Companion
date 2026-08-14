import { useLayoutEffect, useRef, useState } from 'react'
import Btn from './Btn'

export default function SwipeableWizard({ pages, onComplete, indicator = 'fraction', finishLabel = 'Finish', footer, initialPageIndex = 0 }) {
  const [pageIndex, setPageIndex] = useState(initialPageIndex)
  const isLastPage = pageIndex === pages.length - 1

  // Per-page scroll offsets, captured whenever a page is left. Forward
  // navigation always lands at the top of the new page; only Back restores
  // where that specific page was scrolled to before the user moved on from
  // it — same mental model as a browser's own back button.
  const scrollPositions = useRef({})
  const nextScrollMode = useRef('top')

  useLayoutEffect(() => {
    if (nextScrollMode.current === 'restore') {
      window.scrollTo(0, scrollPositions.current[pageIndex] ?? 0)
    } else {
      window.scrollTo(0, 0)
    }
  }, [pageIndex])

  function goNext() {
    if (isLastPage) {
      onComplete?.()
      return
    }
    scrollPositions.current[pageIndex] = window.scrollY
    nextScrollMode.current = 'top'
    setPageIndex((i) => i + 1)
  }

  function goBack() {
    scrollPositions.current[pageIndex] = window.scrollY
    nextScrollMode.current = 'restore'
    setPageIndex((i) => Math.max(0, i - 1))
  }

  return (
    <div className="swipeable-wizard">
      {indicator === 'dots' ? (
        <div className="swipeable-wizard-dots">
          {pages.map((_, i) => (
            <span key={i} className={`wizard-dot ${i === pageIndex ? 'active' : ''}`.trim()} />
          ))}
        </div>
      ) : (
        <div className="swipeable-wizard-progress">
          {pageIndex + 1} / {pages.length}
        </div>
      )}
      <div className="swipeable-wizard-page">
        {pages[pageIndex]}
      </div>
      <div className="swipeable-wizard-nav">
        <Btn type="button" variant="outline" onClick={goBack} disabled={pageIndex === 0}>Back</Btn>
        <Btn type="button" onClick={goNext}>{isLastPage ? finishLabel : 'Next'}</Btn>
      </div>
      {footer}
    </div>
  )
}
