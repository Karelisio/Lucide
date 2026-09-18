interface RatingSliderProps {
  value: number | null;
  onChange: (value: number | null) => void;
}

export function RatingSlider({ value, onChange }: RatingSliderProps) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={value ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: "var(--md-sys-color-primary)" }}
        />
        <span
          style={{
            minWidth: 44,
            textAlign: "center",
            fontSize: 18,
            fontWeight: 600,
            color: "var(--md-sys-color-primary)",
          }}
        >
          {value ?? "–"}/10
        </span>
      </div>
      {value !== null && (
        <button
          type="button"
          className="btn-text"
          style={{ marginTop: 4, padding: 0, height: "auto" }}
          onClick={() => onChange(null)}
        >
          Effacer la note
        </button>
      )}
    </div>
  );
}
