import { Icon } from "./Icon";

interface StarRatingProps {
  value: number | null;
  onChange: (value: number | null) => void;
  max?: number;
  size?: number;
}

export function StarRating({ value, onChange, max = 5, size = 28 }: StarRatingProps) {
  return (
    <div className="stars">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          className={`star-btn${value !== null && n <= value ? " filled" : ""}`}
          onClick={() => onChange(value === n ? null : n)}
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
        >
          <Icon name={value !== null && n <= value ? "star" : "star-outline"} size={size} />
        </button>
      ))}
    </div>
  );
}
