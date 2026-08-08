export default function ConceptDefinition({ concept }) {
  if (!concept) return null

  return (
    <p className="concept-definition" style={{ background: concept.tint }}>
      {concept.definition}
    </p>
  )
}
