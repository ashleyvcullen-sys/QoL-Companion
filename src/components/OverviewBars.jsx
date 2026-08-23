import { severityColorFromPercent } from '../lib/scoring'

export default function OverviewBars({ concepts, overview, onIconClick, compact = false }) {
  const cx = (base) => (compact ? `${base} ${base}--compact` : base)

  return (
    <div className={cx('overview-bars')}>
      {concepts.map(({ key, label, Icon, color }) => {
        const value = overview[key]

        return (
          <div key={key} className={cx('overview-bar-block')}>
            <div className={cx('overview-bar-row')}>
              {onIconClick ? (
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
            </div>
          </div>
        )
      })}
    </div>
  )
}
