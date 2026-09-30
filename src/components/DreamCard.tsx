import { Link } from "react-router-dom";
import type { Dream, EmotionDef, TagDef } from "../types";
import { Icon } from "./Icon";
import { formatShortDate } from "../utils/format";

interface DreamCardProps {
  dream: Dream;
  emotionsById: Map<string, EmotionDef>;
  tagsById: Map<string, TagDef>;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

/** Texte affiché à la place du récit quand il n'y en a pas. */
function missingTextLabel(dream: Dream): string {
  if (dream.audioNotes.length > 0) return "Mémo vocal, pas encore de récit écrit.";
  const hasDetails =
    dream.moodRating !== null ||
    dream.realismRating !== null ||
    dream.emotionIds.length > 0 ||
    dream.tagIds.length > 0 ||
    dream.locations.length > 0 ||
    dream.characters.length > 0;
  if (!hasDetails && dream.sleepQuality !== null) return "Pas de rêve noté — seulement la qualité du sommeil.";
  return "Pas de récit écrit.";
}

export function DreamCard({ dream, emotionsById, tagsById, selectable, selected, onToggleSelect }: DreamCardProps) {
  const hasText = dream.text.trim().length > 0;

  const content = (
    <>
      <div className="dream-card-header">
        <span className="dream-card-date" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {selectable && (
            <span
              aria-hidden="true"
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                border: `1.5px solid ${selected ? "var(--md-sys-color-primary)" : "var(--md-sys-color-outline)"}`,
                background: selected ? "var(--md-sys-color-primary)" : "transparent",
                color: "var(--md-sys-color-on-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {selected && <Icon name="check" size={13} />}
            </span>
          )}
          {formatShortDate(dream.nightDate)}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {dream.audioNotes.length > 0 && <Icon name="mic" size={16} />}
          {dream.moodRating !== null && <span className="badge badge-rating">{dream.moodRating}/10</span>}
        </div>
      </div>
      <p className="dream-card-excerpt">
        {hasText ? dream.text : missingTextLabel(dream)}
      </p>
      <div className="dream-card-footer">
        {dream.sleepQuality !== null && (
          <span className="badge">
            <Icon name="bed" size={14} /> {dream.sleepQuality}/5
          </span>
        )}
        {dream.emotionIds.slice(0, 3).map((id) => {
          const e = emotionsById.get(id);
          if (!e) return null;
          return (
            <span key={id} className="badge">
              {e.emoji} {e.label}
            </span>
          );
        })}
        {dream.tagIds.slice(0, 3).map((id) => {
          const t = tagsById.get(id);
          if (!t) return null;
          return (
            <span key={id} className="badge">
              #{t.label}
            </span>
          );
        })}
      </div>
    </>
  );

  if (selectable) {
    return (
      <button type="button" className="dream-card" style={{ width: "100%", textAlign: "left" }} onClick={onToggleSelect}>
        {content}
      </button>
    );
  }

  return (
    <Link to={`/dreams/${dream.id}`} className="dream-card">
      {content}
    </Link>
  );
}
