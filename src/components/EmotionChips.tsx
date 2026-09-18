import type { EmotionDef } from "../types";

interface EmotionChipsProps {
  emotions: EmotionDef[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

export function EmotionChips({ emotions, selectedIds, onToggle }: EmotionChipsProps) {
  return (
    <div className="chip-row">
      {emotions.map((e) => (
        <button
          key={e.id}
          type="button"
          className={`chip${selectedIds.includes(e.id) ? " selected" : ""}`}
          onClick={() => onToggle(e.id)}
        >
          <span>{e.emoji}</span>
          {e.label}
        </button>
      ))}
    </div>
  );
}
