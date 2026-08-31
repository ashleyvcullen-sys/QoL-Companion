import { FileDown, Heart, HeartHandshake, Pill, Stethoscope, TrendingUp } from 'lucide-react'
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
export const APP_FEATURE_LIST = [
  { Icon: Heart, label: 'Overall Quality of Life Assessments', to: '/assessment' },
  { Icon: Stethoscope, label: 'Disease-Specific Monitoring', to: '/conditions', premium: true },
  { Icon: Pill, label: 'Medication Reminders', to: '/medications', premium: true },
  { Icon: TrendingUp, label: 'Trends Over Time', to: '/trends' },
  { Icon: HomeCareTipsIcon, label: 'Advice For Home Care', to: '/home-care-tips' },
  { Icon: FileDown, label: 'Summaries For Your Vet', to: '/export-report', premium: true },
  { Icon: HeartHandshake, label: 'Support And Preparation For End of Life Decisions', to: '/end-of-life' },
]
