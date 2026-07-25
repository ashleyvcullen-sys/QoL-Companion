export default function IconLabelHeader({ icon: Icon, label }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 600, fontSize: 14, color: "#3D2B30" }}>
      {Icon && (
        <span style={{ width: 22, height: 22, borderRadius: 6, background: "#FBEFF1", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={12} color="#C97B8C" />
        </span>
      )}
      {label}
    </span>
  )
}
