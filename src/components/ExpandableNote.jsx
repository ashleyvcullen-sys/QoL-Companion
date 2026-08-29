import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'

// A short explanation that stays out of the way until it is asked for.
//
// The alternative — and what this replaces on the sleep question — is a
// paragraph or two of background sitting permanently above the thing the
// owner came to do. It is genuinely useful the first week and pure friction
// every week after, because it pushes the actual question down the screen for
// someone who read it in March and is now filling this in for the ninetieth
// time.
//
// An inline expander rather than a modal, unlike `HowTo` in ConditionParameter.
// That one opens a sheet because it is read WHILE measuring something, so it
// has to survive being looked away from. This is read once, before answering,
// and a sheet for two sentences is a heavier gesture than the content
// deserves.
//
// `hidden` rather than unmounting: the browser keeps the text findable and
// screen readers keep the relationship between the button and what it
// controls, which `aria-controls` is pointing at either way.
export default function ExpandableNote({ label, children, className = '' }) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()

  return (
    <div className={`expandable-note ${className}`.trim()}>
      <button
        type="button"
        className="expandable-note-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <span>{label}</span>
        {/* Points down when there is more to see and up once it is open, so
            the arrow describes the state rather than the action. */}
        <ChevronDown
          size={16}
          className={`expandable-note-chevron ${open ? 'is-open' : ''}`.trim()}
          aria-hidden="true"
        />
      </button>

      <div id={bodyId} className="expandable-note-body" hidden={!open}>
        {children}
      </div>
    </div>
  )
}
