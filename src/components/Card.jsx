import { forwardRef } from 'react'

// forwardRef so a caller can measure the card — the tour positions its
// message against its own height, which it cannot read without a ref.
const Card = forwardRef(function Card({ children, className = '', ...props }, ref) {
  return (
    <div ref={ref} className={`card ${className}`.trim()} {...props}>
      {children}
    </div>
  )
})

export default Card
