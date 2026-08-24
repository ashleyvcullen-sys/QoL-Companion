export default function ScoreSlider({ label, prompt, value, onChange, max = 10, scaleLabels, icon: Icon, extraOption }) {
  const isUnsure = value === "unsure";
  const isExtraOption = extraOption != null && value === extraOption.value;
  return (
    <div className="score-slider">
      <div className="score-slider-header">
        <span className="score-slider-label">
          {Icon && (
            <span className="score-slider-icon">
              {/* currentColor rather than the accent hex, so the tint comes
                  from the stylesheet's tokens like everything else. */}
              <Icon size={12} color="currentColor" />
            </span>
          )}
          {label}
        </span>
        <span className="score-slider-value">
          {isUnsure || isExtraOption ? "—" : value}
          <span className="score-slider-value-max">/{max}</span>
        </span>
      </div>
      {prompt && <p className="score-slider-prompt">{prompt}</p>}
      <div className="score-slider-scale">
        {Array.from({ length: max + 1 }, (_, n) => n).map(n => {
          const selected = !isUnsure && !isExtraOption && value === n;
          const frac = max > 0 ? n / max : 0;
          /* The step's own colour travels as a custom property so the
             selected/unselected styling lives in CSS rather than being
             rebuilt as an inline style object on every render. */
          const scoreColour =
            frac <= 0.3
              ? "var(--severity-severe)"
              : frac <= 0.6
                ? "var(--severity-moderate)"
                : "var(--severity-good)";
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={selected ? "score-slider-step is-selected" : "score-slider-step"}
              style={{ "--score-colour": scoreColour }}
            >
              {n}
            </button>
          );
        })}
      </div>
      {scaleLabels && (
        <div className="score-slider-scale-labels">
          <span className="score-slider-scale-label">{scaleLabels[0]}</span>
          <span className="score-slider-scale-label is-middle">{scaleLabels[1]}</span>
          <span className="score-slider-scale-label is-end">{scaleLabels[2]}</span>
        </div>
      )}
      <div className={scaleLabels ? "score-slider-options" : "score-slider-options is-spaced"}>
        <button
          type="button"
          onClick={() => onChange("unsure")}
          className={isUnsure ? "score-slider-option is-selected" : "score-slider-option"}
        >
          Not sure
        </button>
        {extraOption && (
          <button
            type="button"
            onClick={() => onChange(extraOption.value)}
            className={isExtraOption ? "score-slider-option is-selected" : "score-slider-option"}
          >
            {extraOption.label}
          </button>
        )}
      </div>
    </div>
  );
}
