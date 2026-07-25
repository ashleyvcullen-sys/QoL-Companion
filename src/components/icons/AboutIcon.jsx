export default function AboutIcon({ size = 22, color = '#C97B8C' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth="1.8" fill="none" />
      <path d="M9 9.3 C9 7.5 10.3 6.2 12 6.2 C13.7 6.2 15 7.4 15 9 C15 10.4 14.1 11.1 13.1 11.8 C12.3 12.4 12 12.9 12 13.8"
        stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <circle cx="12" cy="17" r="1.15" fill={color} />
    </svg>
  )
}
