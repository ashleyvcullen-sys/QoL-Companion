import OrganIcon from './OrganIcon'

// Superseded by the traced line-art in public/images/organs. Kept as a named
// wrapper so existing imports keep working and the intent stays readable.
export default function AnatomicalHeartIcon(props) {
  return <OrganIcon name="heart" {...props} />
}
