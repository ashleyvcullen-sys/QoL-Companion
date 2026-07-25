export default function PooIcon({ size = 14, color = '#C97B8C' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3c1 0 1.6.9 1.2 1.8-.3.6-.9.7-.6 1.3.3.6 1.6.2 2.2 1 .5.7.1 1.4.6 1.8.6.5 1.8.1 2.6 1.1 1 1.3-.1 2.4-.9 2.6 1.6.4 3 1.7 3 3.6C20.1 19.2 17 20 12 20s-8.1-.8-8.1-3.8c0-1.9 1.4-3.2 3-3.6-.8-.2-1.9-1.3-.9-2.6.8-1 2-.6 2.6-1.1.5-.4.1-1.1.6-1.8.6-.8 1.9-.4 2.2-1 .3-.6-.3-.7-.6-1.3C10.4 3.9 11 3 12 3Z"
        fill={color} stroke={color} strokeWidth="0.5" strokeLinejoin="round" />
      <circle cx="9.5" cy="16.5" r="1" fill="#FFFFFF" opacity="0.7" />
      <circle cx="14.5" cy="17.5" r="0.8" fill="#FFFFFF" opacity="0.6" />
    </svg>
  )
}
