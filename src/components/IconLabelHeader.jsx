export default function IconLabelHeader({ icon: Icon, label }) {
  return (
    <span className="icon-label-header">
      {Icon && (
        <span className="icon-label-header-badge">
          <Icon size={12} />
        </span>
      )}
      {label}
    </span>
  )
}
