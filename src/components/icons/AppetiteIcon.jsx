export default function AppetiteIcon({ size = 20, color = '#C97B8C' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.5 11 C3.5 15.5 7.3 19 12 19 C16.7 19 20.5 15.5 20.5 11" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M3.5 11 A8.5 3.2 0 0 1 20.5 11" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M9 6 V3.3 M12 6 V3 M15 6 V3.3" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}
