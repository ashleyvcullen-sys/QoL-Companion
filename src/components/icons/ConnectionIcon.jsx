export default function ConnectionIcon({ size = 20, color = '#C97B8C' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="12" r="5.5" stroke={color} strokeWidth="1.4" fill="none" />
      <circle cx="15" cy="12" r="5.5" stroke={color} strokeWidth="1.4" fill="none" opacity="0.65" />
    </svg>
  )
}
