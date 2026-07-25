export default function CuriosityIcon({ size = 20, color = '#C97B8C' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="6.2" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M14.5 14.5 L20 20" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 8.5 C8 7 11.5 6.7 11.5 9 C11.5 10.5 10 10.3 10 12" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  )
}
