import { useState } from 'react'
import Btn from './Btn'

export default function SwipeableWizard({ pages, onComplete, indicator = 'fraction', finishLabel = 'Finish', footer }) {
  const [pageIndex, setPageIndex] = useState(0)
  const isLastPage = pageIndex === pages.length - 1

  function goNext() {
    if (isLastPage) {
      onComplete?.()
    } else {
      setPageIndex((i) => i + 1)
    }
  }

  function goBack() {
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
