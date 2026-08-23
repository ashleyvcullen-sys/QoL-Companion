// Line-art organ icons, stored as PNG masks in public/images/organs.
//
// The artwork carries its shape entirely in the alpha channel — the pixels
// themselves are white — so the icon is painted by CSS rather than baked in.
// That means ONE file works white on a coloured badge and dark on a card,
// and it picks up currentColor like any lucide icon does.
//
// A mask rather than an <img> for exactly that reason: an <img> would be
// locked to the colour it was drawn in, and would need a second file (and a
// second thing to keep in sync) for every context it appears in.
export default function OrganIcon({ name, size = 24, color = 'currentColor' }) {
  const url = `/images/organs/${name}.png`
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        backgroundColor: color,
        WebkitMaskImage: `url("${url}")`,
        maskImage: `url("${url}")`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  )
}

// Named bindings, exported from here so that files which only need to
// REFERENCE an icon (like lib/conditions.js) can stay plain .js — Vite does
// not transform JSX in a .js file, so a single inline arrow component there
// would break the build.
export const HeartOrganIcon = (props) => <OrganIcon name="heart" {...props} />
export const KidneyOrganIcon = (props) => <OrganIcon name="kidney" {...props} />
export const BoneOrganIcon = (props) => <OrganIcon name="bone" {...props} />
export const BrainOrganIcon = (props) => <OrganIcon name="brain" {...props} />
export const EyeOrganIcon = (props) => <OrganIcon name="eye" {...props} />
export const GutOrganIcon = (props) => <OrganIcon name="gut" {...props} />
