import { Fragment } from 'react'
import { petTextParts } from '../lib/petText'

// Renders a template containing {name}/{they}/{their} tokens and **bold**
// runs. Kept as a component so every screen emphasises and pronouns the same
// way, rather than each one doing its own string handling.
export default function PetText({ template, pet }) {
  return (
    <>
      {petTextParts(template, pet).map((part, i) => (
        <Fragment key={i}>{part.bold ? <strong>{part.text}</strong> : part.text}</Fragment>
      ))}
    </>
  )
}
