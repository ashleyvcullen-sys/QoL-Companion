export default function PuddleIcon({ size = 14, color = '#C97B8C' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 C9 8 6.5 11 6.5 14 C6.5 17.5 9 19.5 12 19.5 C15 19.5 17.5 17.5 17.5 14 C17.5 11 15 8 12 3 Z" stroke={color} strokeWidth="1.6" fill="none" />
      <ellipse cx="12" cy="21" rx="7" ry="1.6" stroke={color} strokeWidth="1.3" fill="none" />
    </svg>
  )
}
