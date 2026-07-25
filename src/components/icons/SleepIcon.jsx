export default function SleepIcon({ size = 20, color = '#C97B8C' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 8 H12 L4 15 H12" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M13.5 5 H18 L13.5 9.5 H18" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.75" />
      <path d="M16.5 2.5 H19.5 L16.5 5.5 H19.5" stroke={color} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.55" />
    </svg>
  )
}
