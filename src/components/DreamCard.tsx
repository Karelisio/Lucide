import { Link } from "react-router-dom";
import type { Dream, EmotionDef, TagDef } from "../types";
import { Icon } from "./Icon";
import { formatShortDate } from "../utils/format";

interface DreamCardProps {
  dream: Dream;
  emotionsById: Map<string, EmotionDef>;
  tagsById: Map<string, TagDef>;
}

export function DreamCard({ dream, emotionsById, tagsById }: DreamCardProps) {
  const hasText = dream.text.trim().length > 0;
  return (
    <Link to={`/dreams/${dream.id}`} className="dream-card">
      <div className="dream-card-header">
        <span className="dream-card-date">{formatShortDate(dream.nightDate)}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {dream.audioNotes.length > 0 && <Icon name="mic" size={16} />}
          {dream.dreamRating !== null && <span className="badge badge-rating">{dream.dreamRating}/10</span>}
        </div>
      </div>
      <p className="dream-card-excerpt">
        {hasText ? dream.text : "Pas de rêve noté — seulement la qualité du sommeil."}
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
    </Link>
  );
}
