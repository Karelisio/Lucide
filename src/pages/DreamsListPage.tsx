import { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/Icon";
import { DreamCard } from "../components/DreamCard";
import { useAppState } from "../state/AppStateContext";
import { listDreams } from "../db/dreamRepository";
import type { Dream } from "../types";

export function DreamsListPage() {
  const { emotions, tags } = useAppState();
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [query, setQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedEmotionIds, setSelectedEmotionIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);

  const emotionsById = useMemo(() => new Map(emotions.map((e) => [e.id, e])), [emotions]);
  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  useEffect(() => {
    setLoading(true);
    const handle = window.setTimeout(async () => {
      const results = await listDreams({ query, tagIds: selectedTagIds, emotionIds: selectedEmotionIds });
      setDreams(results);
      setLoading(false);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query, selectedTagIds, selectedEmotionIds]);

  function toggleTag(id: string) {
    setSelectedTagIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }
  function toggleEmotion(id: string) {
    setSelectedEmotionIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  const activeFilterCount = selectedTagIds.length + selectedEmotionIds.length;

  return (
    <div>
      <div className="top-app-bar" style={{ margin: "-16px -16px 16px" }}>
        <h1>Rêves</h1>
        <div className="spacer" />
        <button
          className="icon-button"
          onClick={() => setShowFilters((s) => !s)}
          aria-label="Filtres"
          style={{ position: "relative" }}
        >
          <Icon name="filter" />
          {activeFilterCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--md-sys-color-error)",
              }}
            />
          )}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Icon name="search" size={18} className="icon-button" />
        <input
          className="text-field"
          placeholder="Rechercher dans les rêves…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {showFilters && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="field-label">Tags</p>
          <div className="chip-row" style={{ marginBottom: 16 }}>
            {tags.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`chip${selectedTagIds.includes(t.id) ? " selected" : ""}`}
                onClick={() => toggleTag(t.id)}
              >
                #{t.label}
              </button>
            ))}
            {tags.length === 0 && <span style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>Aucun tag créé</span>}
          </div>
          <p className="field-label">Émotions</p>
          <div className="chip-row">
            {emotions.map((e) => (
              <button
                key={e.id}
                type="button"
                className={`chip${selectedEmotionIds.includes(e.id) ? " selected" : ""}`}
                onClick={() => toggleEmotion(e.id)}
              >
                {e.emoji} {e.label}
              </button>
            ))}
          </div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="btn-text"
              style={{ marginTop: 12, padding: 0 }}
              onClick={() => {
                setSelectedTagIds([]);
                setSelectedEmotionIds([]);
              }}
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}

      {!loading && dreams.length === 0 && (
        <div className="empty-state">
          <Icon name="moon" size={36} />
          <p>Aucun rêve ne correspond à ta recherche.</p>
        </div>
      )}
      {dreams.map((d) => (
        <DreamCard key={d.id} dream={d} emotionsById={emotionsById} tagsById={tagsById} />
      ))}
    </div>
  );
}
