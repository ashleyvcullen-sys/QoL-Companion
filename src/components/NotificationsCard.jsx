import { AlertTriangle, Check } from 'lucide-react'
import Card from './Card'
import SectionTitle from './SectionTitle'
import Btn from './Btn'

// Whether the app can reach this phone at all — the precondition for every
// cadence control on the Reminders screen.
//
// At the TOP of that screen, on Ash's instruction 3 Sep 2026. The state used
// to live at the bottom and only when something was wrong: an "Enable
// reminders" card when permission had never been asked for, an "Open
// Settings" card when it had been denied, and a separate exact-alarms card
// below both. When everything was granted there was nothing at all — so an
// owner had no way to confirm the app could still reach them, and no route
// to change the sound or the banner style.
//
// Three cards became one, and one that shrinks. Granted is a single quiet
// line and costs almost nothing at the top; the states that need action grow
// into the space and are then the first thing on the screen rather than the
// last. Setting a cadence under a channel that cannot deliver is the failure
// this placement exists to prevent.
export default function NotificationsCard({
  notifStatus,
  exactAlarmStatus,
  isAndroid,
  onEnable,
  onEnableExactAlarms,
  onOpenSettings,
}) {
  // Nothing to say off-device: there is no notification permission in a
  // browser, and a card reporting on one would be reporting on nothing.
  if (!notifStatus) return null

  const denied = notifStatus === 'denied'
  const canAsk = notifStatus === 'prompt' || notifStatus === 'prompt-with-rationale'
  const granted = notifStatus === 'granted'

  return (
    <Card>
      <SectionTitle>Notifications</SectionTitle>

      {granted && (
        <>
          <p className="notif-state">
            <Check size={15} strokeWidth={2.5} />
            Notifications are on
          </p>
          <p className="notif-sub">
            Reminders can reach this phone. Sounds and banner style are set in your phone&apos;s
            settings.
          </p>
          <button type="button" className="subtle-link notif-link" onClick={onOpenSettings}>
            Open notification settings
          </button>
        </>
      )}

      {canAsk && (
        <>
          <p className="notif-state off">
            <AlertTriangle size={15} />
            Notifications are not set up
          </p>
          <p className="notif-sub">
            Allow them and the app can remind you when a check-in or a dose is due.
          </p>
          <Btn type="button" className="btn-block notif-action" onClick={onEnable}>
            Enable reminders
          </Btn>
        </>
      )}

      {denied && (
        <>
          <p className="notif-state off">
            <AlertTriangle size={15} />
            Notifications are off
          </p>
          {/* Names what is lost rather than saying "reminders are off". The
              settings below are still editable while this is true, and an
              owner who has just chosen a cadence should know it cannot
              currently reach them. */}
          <p className="notif-sub">
            Nothing can reach you &mdash; no check-ins and no dose reminders. The settings
            below are saved, and will start working once notifications are back on.
          </p>
          <Btn type="button" variant="outline" className="btn-block notif-action" onClick={onOpenSettings}>
            Open Settings
          </Btn>
        </>
      )}

      {/* Android only, and dormant on iOS — `isAndroid` is false there, so
          this never renders. Kept rather than deleted: exact alarms are a
          real Android 12+ requirement and this is working code that would
          have to be written again for the Android build.
          //
          Folded in here rather than left as its own card at the foot of the
          screen, so "can this app reach me" has one answer in one place. */}
      {isAndroid && granted && exactAlarmStatus && exactAlarmStatus !== 'granted' && (
        <div className="notif-secondary">
          <p className="notif-state warn">
            <AlertTriangle size={15} />
            Precise timing is off
          </p>
          <p className="notif-sub">
            Reminders still arrive, just not always at the exact minute.
          </p>
          {(exactAlarmStatus === 'prompt' || exactAlarmStatus === 'prompt-with-rationale') && (
            <Btn
              type="button"
              variant="outline"
              className="btn-block notif-action"
              onClick={onEnableExactAlarms}
            >
              Enable precise timing
            </Btn>
          )}
        </div>
      )}
    </Card>
  )
}
