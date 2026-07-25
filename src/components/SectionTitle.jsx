export default function SectionTitle({ children, ...props }) {
  return (
    <h2 className="section-title" {...props}>
      {children}
    </h2>
  )
}
