import { Camera, FileDown, Heart, HeartHandshake, Pill, Scale, Stethoscope, TrendingUp } from 'lucide-react'
import HomeCareTipsIcon from '../components/icons/HomeCareTipsIcon'

// What the app does, as one list.
//
// NOT the same list as PAYWALL_FEATURE_LIST, and the difference matters.
// That one sells: it is the six things Premium ADDS, phrased to be worth
// paying for. This one introduces: it is what the app is for, free and paid
// together, and it carries an icon and a destination because it is rendered
// as rows you can look at and — on About — tap.
//
// One definition because it had two. About listed seven features; the signup
// intro listed five of them, silently missing disease monitoring and
// medications, so a new account was shown a smaller app than exists and then
// a bigger one later. A wording change had to be made twice to land, which is
// the kind of thing that gets made once.
//
// `premium` marks the rows a subscription is needed for. It agrees with the
// paid features in PAYWALL_FEATURE_LIST and with the locked tiles on Home —
// see the note in Home.jsx's NAV_SECTIONS, which still keeps its own shorter
// tile labels and its own flags.
// Ordered on Ash's instruction, 3 Sep 2026: everything free first, then the
// premium rows together, then End of Life last whatever its tier.
//
// Grouping matters because this list is also the answer to "what do I get if
// I pay?" — interleaved, a reader had to check each row's badge to work that
// out, and the four paid features read as four unrelated extras rather than
// as a tier.
//
// End of Life stays at the bottom regardless. It is the one row nobody wants
// to need, and putting it anywhere but last makes an owner read past it to
// find what they came for.
export const APP_FEATURE_LIST = [
  { Icon: Heart, label: 'Overall Quality of Life Assessments', to: '/assessment' },
  { Icon: TrendingUp, label: 'Trends Over Time', to: '/trends' },
  { Icon: HomeCareTipsIcon, label: 'Advice For Home Care', to: '/home-care-tips' },

  // --- Premium ----------------------------------------------------------
  { Icon: Stethoscope, label: 'Disease-Specific Monitoring', to: '/conditions', premium: true },
  { Icon: Pill, label: 'Medication Reminders', to: '/medications', premium: true },
  // Was missing entirely — Ash spotted it. It is a paid feature on Home, in
  // PAYWALL_FEATURE_LIST and in the Terms, and the only list that never
  // mentioned it was the one an owner reads first.
  { Icon: Scale, label: 'Body Condition and Weight Tracking', to: '/body-condition', premium: true },
  { Icon: Camera, label: 'Photos and Videos', to: '/media', premium: true },
  { Icon: FileDown, label: 'Summaries For Your Vet', to: '/export-report', premium: true },

  // --- Last, always -----------------------------------------------------
  { Icon: HeartHandshake, label: 'Support And Preparation For End of Life Decisions', to: '/end-of-life' },
]
