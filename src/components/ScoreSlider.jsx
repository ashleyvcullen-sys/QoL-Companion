export default function ScoreSlider({ label, prompt, value, onChange, max = 10, scaleLabels, icon: Icon }) {
  const isUnsure = value === "unsure";
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 600, fontSize: 14, color: "#3D2B30" }}>
          {Icon && (
            <span style={{ width: 22, height: 22, borderRadius: 6, background: "#FBEFF1", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon size={12} color="#C97B8C" />
            </span>
          )}
          {label}
        </span>
        <span>{isUnsure ? "—" : value}<span style={{ color: "#B79AA0", fontSize: 12 }}>/{max}</span></span>
      </div>
      {prompt && <p style={{ fontSize: 12.5, color: "#9C7C86", margin: "0 0 8px" }}>{prompt}</p>}
      <div style={{ display: "flex", gap: 3, flexWrap: "nowrap" }}>
        {Array.from({ length: max + 1 }, (_, n) => n).map(n => {
          const selected = !isUnsure && value === n;
          const frac = max > 0 ? n / max : 0;
          const scoreColor = frac <= 0.3 ? "#A33A2E" : frac <= 0.6 ? "#C97A2E" : "#3D8259";
          return (
            <button key={n} type="button" onClick={() => onChange(n)}
              style={{
                flex: "1 1 0", minWidth: 0, height: 30, borderRadius: 6, cursor: "pointer", padding: 0,
                border: selected ? `1px solid ${scoreColor}` : "1px solid #EAC6CE",
                background: selected ? scoreColor : "#FFFBFC",
                color: selected ? "#fff" : "#7A5B63",
                fontSize: 11.5, fontWeight: 700,
              }}>
              {n}
            </button>
          );
        })}
      </div>
      {scaleLabels && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "#B79AA0", maxWidth: "34%" }}>{scaleLabels[0]}</span>
          <span style={{ fontSize: 11, color: "#B79AA0", maxWidth: "28%", textAlign: "center" }}>{scaleLabels[1]}</span>
          <span style={{ fontSize: 11, color: "#B79AA0", maxWidth: "34%", textAlign: "right" }}>{scaleLabels[2]}</span>
        </div>
      )}
      <button type="button" onClick={() => onChange("unsure")}
        style={{
          marginTop: scaleLabels ? 0 : 8, fontSize: 11.5, fontWeight: 600, padding: "5px 12px", borderRadius: 20, cursor: "pointer",
          border: isUnsure ? "1px solid #9C7C86" : "1px solid #EAC6CE",
          background: isUnsure ? "#9C7C86" : "#FFFBFC",
          color: isUnsure ? "#fff" : "#9C7C86",
        }}>
        Not sure
      </button>
    </div>
  );
}
