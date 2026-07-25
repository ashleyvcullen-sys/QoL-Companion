export default function ChoiceButtons({ options, value, onChange }) {
  return (
    <div className="choice-buttons">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`choice-button ${value === option.value ? 'selected' : ''}`.trim()}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
