export default function EyesIcon({ size = 14, color = '#C97B8C' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="7" cy="12" rx="4.2" ry="3" stroke={color} strokeWidth="1.6" fill="none" />
      <ellipse cx="17" cy="12" rx="4.2" ry="3" stroke={color} strokeWidth="1.6" fill="none" />
      <circle cx="7" cy="12" r="1.5" fill={color} />
      <circle cx="17" cy="12" r="1.5" fill={color} />
    </svg>
  )
}
