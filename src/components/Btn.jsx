const VARIANTS = ['primary', 'outline', 'ghost', 'danger']

export default function Btn({ children, variant = 'primary', className = '', ...props }) {
  const resolvedVariant = VARIANTS.includes(variant) ? variant : 'primary'
  return (
    <button className={`btn btn-${resolvedVariant} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}
