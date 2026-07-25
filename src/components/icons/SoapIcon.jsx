export default function SoapIcon({ size = 14, color = '#C97B8C' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="10" width="13" height="8" rx="3.5" stroke={color} strokeWidth="1.6" fill="none" />
      <path d="M6.5 10 C6 8 8 7 9.5 8 C10.5 6.5 13 7 13 9" stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <circle cx="18.5" cy="7.5" r="2.1" stroke={color} strokeWidth="1.3" fill="none" />
      <circle cx="20.5" cy="12.5" r="1.3" stroke={color} strokeWidth="1.2" fill="none" />
    </svg>
  )
}
