import { severityColorFromPercent } from '../lib/scoring'

// The five pillars, as bars.
//
// ONE control per row where `onSelect` is given — Ash's instruction 5 Sep
// 2026. It had two for a few hours: the icon opened the pillar's definition
// and the rest of the row opened its chart. Two targets an inch apart doing
// different things, with nothing to say which was which, is a puzzle rather
// than a control. The whole row now opens the chart, and the definition
// travels with it.
//
// The overlay is a sibling of the icon rather than a wrapper around it, and
// the icon drops to a plain span when the row is selectable: a button inside
// a button is invalid HTML and the browser swallows the inner click.
export default function OverviewBars({ concepts, overview, onIconClick, onSelect, selectedKey, compact = false }) {
  const cx = (base) => (compact ? `${base} ${base}--compact` : base)

  return (
    <div className={cx('overview-bars')}>
      {concepts.map(({ key, label, Icon, color }) => {
        const value = overview[key]

        return (
          <div key={key} className={cx('overview-bar-block')}>
            <div className={`${cx('overview-bar-row')} ${onSelect ? 'is-selectable' : ''} ${selectedKey === key ? 'is-open' : ''}`.trim()}>
              {onIconClick && !onSelect ? (
                <button
                  type="button"
                  className={cx('overview-bar-icon')}
                  style={{ background: color }}
                  onClick={() => onIconClick(key)}
                >
                  <Icon size={compact ? 10 : 16} color="#fff" />
                </button>
              ) : (
                <span className={cx('overview-bar-icon')} style={{ background: color }}>
                  <Icon size={compact ? 10 : 16} color="#fff" />
                </span>
              )}
              <span className={cx('overview-bar-label')}>{label}</span>
              <div className="overview-bar-track">
                <div
                  className="overview-bar-fill"
                  style={{
                    width: `${value ?? 0}%`,
                    background: value != null ? severityColorFromPercent(value) : 'var(--border)',
                  }}
                />
              </div>
              <span className={cx('overview-bar-percent')}>
                {value != null ? `${Math.round(value)}%` : '—'}
              </span>

              {/* Laid over the whole row — icon included, since the icon is a
                  plain span when the row is selectable. A sibling rather than
                  a wrapper because buttons cannot nest. */}
              {onSelect && (
                <button
                  type="button"
                  className="overview-bar-hit"
                  aria-expanded={selectedKey === key}
                  aria-label={`${label} over time`}
                  onClick={() => onSelect(key)}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
