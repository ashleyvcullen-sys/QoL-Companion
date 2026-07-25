export default function DropletsIcon({ size = 14, color = '#C97B8C' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 2.5 C6 6 4.2 8.3 4.2 10.5 C4.2 12.9 6 14.6 8 14.6 C10 14.6 11.8 12.9 11.8 10.5 C11.8 8.3 10 6 8 2.5 Z" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M17 9 C15.6 11.5 14.5 13 14.5 14.5 C14.5 16.2 15.7 17.4 17 17.4 C18.3 17.4 19.5 16.2 19.5 14.5 C19.5 13 18.4 11.5 17 9 Z" stroke={color} strokeWidth="1.3" fill="none" />
      <path d="M9.5 17 C8.4 18.9 7.6 20 7.6 21.1 C7.6 22.3 8.5 23.2 9.5 23.2" stroke={color} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}
