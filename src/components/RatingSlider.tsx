interface RatingSliderProps {
  value: number | null;
  onChange: (value: number | null) => void;
  lowHint: string;
  highHint: string;
}

export function RatingSlider({ value, onChange, lowHint, highHint }: RatingSliderProps) {
  const empty = value === null;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/*
          Sans note : curseur estompé au milieu, pas à 0 (qui se lirait « Cauchemar »). Un tap fixe la
          note où qu'il tombe : taper la position déjà affichée ne déclenche pas onChange (ce qui rendait
          0 impossible à choisir d'un seul tap quand le curseur y était), d'où onPointerUp — au doigt,
          un curseur ne reçoit pas de click.
        */}
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={value ?? 5}
          aria-valuetext={empty ? "Non noté" : undefined}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerUp={(e) => {
            if (empty) onChange(Number(e.currentTarget.value));
          }}
          style={{ flex: 1, accentColor: "var(--md-sys-color-primary)", opacity: empty ? 0.4 : 1 }}
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 12,
          color: "var(--md-sys-color-on-surface-variant)",
          marginTop: 2,
        }}
      >
        <span>{lowHint}</span>
        <span>{highHint}</span>
      </div>
      {value !== null && (
        <button
          type="button"
          className="btn btn-text"
          style={{ marginTop: 4, padding: 0, height: "auto" }}
          onClick={() => onChange(null)}
        >
          Effacer la note
        </button>
      )}
    </div>
  );
}
