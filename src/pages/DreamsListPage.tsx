import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { DreamCard } from "../components/DreamCard";
import { SwipeToDelete } from "../components/SwipeToDelete";
import { CalendarView } from "../components/CalendarView";
import { useAppState } from "../state/AppStateContext";
import { useSnackbar } from "../state/SnackbarContext";
import { addTagToDreams, listDreams } from "../db/dreamRepository";
import { UNDO_DELAY_MS, deleteDreamsWithUndo, onDeletionUndone } from "../db/pendingDeletions";
import { addRecentSearch, getRecentSearches } from "../utils/recentSearches";
import { computeFrequency } from "../utils/stats";
import type { Dream } from "../types";

type ViewMode = "list" | "calendar";

export function DreamsListPage() {
  const navigate = useNavigate();
  const { emotions, tags } = useAppState();
  const { show } = useSnackbar();
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [query, setQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedEmotionIds, setSelectedEmotionIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagPickerOpen, setBulkTagPickerOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  // Incrémenté pour recharger la liste (suppression annulée, éventuellement depuis un autre écran).
  const [reloadKey, setReloadKey] = useState(0);

  const emotionsById = useMemo(() => new Map(emotions.map((e) => [e.id, e])), [emotions]);
  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  useEffect(() => {
    getRecentSearches().then(setRecentSearches);
  }, []);

  useEffect(() => onDeletionUndone(() => setReloadKey((k) => k + 1)), []);

  useEffect(() => {
    setLoading(true);
    const handle = window.setTimeout(async () => {
      // Les rêves en cours de suppression sont exclus par listDreams (marqués en base).
      const results = await listDreams({ query, tagIds: selectedTagIds, emotionIds: selectedEmotionIds });
      setDreams(results);
      setLoading(false);
      if (query.trim().length >= 2) {
        addRecentSearch(query).then(setRecentSearches);
      }
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query, selectedTagIds, selectedEmotionIds, reloadKey]);

  const tagsForFilter = useMemo(() => {
    const counts = new Map(computeFrequency(dreams, (d) => d.tagIds, tagsById).map((f) => [f.id, f.count]));
    return [...tags].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.label.localeCompare(b.label));
  }, [tags, dreams, tagsById]);

  function handleSwipeDelete(dream: Dream) {
    setDreams((prev) => prev.filter((d) => d.id !== dream.id));
    const pending = deleteDreamsWithUndo([dream.id]);
    show("Rêve supprimé.", { actionLabel: "Annuler", duration: UNDO_DELAY_MS, onAction: pending.undo });
  }

  function toggleSelectionMode() {
    setSelectionMode((m) => !m);
    setSelectedIds(new Set());
  }

  function toggleSelectDream(id: string) {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  }

  function handleBulkDelete() {
    const ids = dreams.filter((d) => selectedIds.has(d.id)).map((d) => d.id);
    if (ids.length === 0) return;
    setDreams((prev) => prev.filter((d) => !selectedIds.has(d.id)));
    const pending = deleteDreamsWithUndo(ids);
    setSelectionMode(false);
    setSelectedIds(new Set());
    show(`${ids.length} rêve(s) supprimé(s).`, { actionLabel: "Annuler", duration: UNDO_DELAY_MS, onAction: pending.undo });
  }

  async function handleBulkAddTag(tagId: string) {
    const ids = Array.from(selectedIds);
    setBulkTagPickerOpen(false);
    if (ids.length === 0) return;
    await addTagToDreams(ids, tagId);
    const results = await listDreams({ query, tagIds: selectedTagIds, emotionIds: selectedEmotionIds });
    setDreams(results);
    setSelectionMode(false);
    setSelectedIds(new Set());
    show(`Tag ajouté à ${ids.length} rêve(s).`);
  }

  function toggleTag(id: string) {
    setSelectedTagIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }
  function toggleEmotion(id: string) {
    setSelectedEmotionIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  const activeFilterCount = selectedTagIds.length + selectedEmotionIds.length;

  const dreamsByNight = useMemo(() => {
    const map = new Map<string, Dream>();
    for (const d of dreams) {
      if (!map.has(d.nightDate)) map.set(d.nightDate, d);
    }
    return map;
  }, [dreams]);

  function handleSelectDay(nightDate: string, dream: Dream | undefined) {
    if (dream) {
      navigate(`/dreams/${dream.id}`);
    } else {
      navigate(`/dreams/new?night=${nightDate}`);
    }
  }

  return (
    <div>
      <div className="top-app-bar" style={{ margin: "-16px -16px 16px" }}>
        <h1>Rêves</h1>
        <div className="spacer" />
        <button
          className="icon-button"
          onClick={() => setViewMode((m) => (m === "list" ? "calendar" : "list"))}
          aria-label={viewMode === "list" ? "Vue calendrier" : "Vue liste"}
        >
          <Icon name={viewMode === "list" ? "calendar" : "list"} />
        </button>
        {viewMode === "list" && (
          <button
            className="icon-button"
            onClick={toggleSelectionMode}
            aria-label={selectionMode ? "Quitter la sélection" : "Sélectionner plusieurs rêves"}
            style={selectionMode ? { color: "var(--md-sys-color-primary)" } : undefined}
          >
            <Icon name="check-square" />
          </button>
        )}
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

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: query ? 8 : 16 }}>
        <Icon name="search" size={18} className="icon-button" />
        <input
          className="text-field"
          placeholder="Rechercher dans les rêves…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!query && recentSearches.length > 0 && (
        <div className="chip-row" style={{ marginBottom: 16 }}>
          {recentSearches.map((term) => (
            <button key={term} type="button" className="chip" onClick={() => setQuery(term)}>
              <Icon name="search" size={13} />
              {term}
            </button>
          ))}
        </div>
      )}

      {showFilters && (
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="field-label">Tags</p>
          <div className="chip-row" style={{ marginBottom: 16 }}>
            {tagsForFilter.map((t) => (
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
              className="btn btn-text"
              style={{ marginTop: 12, padding: 0, height: "auto" }}
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

      {viewMode === "calendar" ? (
        <CalendarView
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          dreamsByNight={dreamsByNight}
          onSelectDay={handleSelectDay}
        />
      ) : (
        <>
          {!loading && dreams.length === 0 && (
            <div className="empty-state">
              <Icon name="moon" size={36} />
              <p>Aucun rêve ne correspond à ta recherche.</p>
            </div>
          )}
          {dreams.map((d) =>
            selectionMode ? (
              <DreamCard
                key={d.id}
                dream={d}
                emotionsById={emotionsById}
                tagsById={tagsById}
                selectable
                selected={selectedIds.has(d.id)}
                onToggleSelect={() => toggleSelectDream(d.id)}
              />
            ) : (
              <SwipeToDelete key={d.id} ariaLabel={`Rêve du ${d.nightDate}`} onDelete={() => handleSwipeDelete(d)}>
                <DreamCard dream={d} emotionsById={emotionsById} tagsById={tagsById} />
              </SwipeToDelete>
            ),
          )}
        </>
      )}

      {selectionMode && selectedIds.size > 0 && (
        <div className="bulk-action-bar">
          <span style={{ fontSize: 14 }}>{selectedIds.size} sélectionné(s)</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              className="icon-button"
              aria-label="Ajouter un tag à la sélection"
              onClick={() => setBulkTagPickerOpen(true)}
              disabled={tags.length === 0}
            >
              <Icon name="tag" size={18} />
            </button>
            <button type="button" className="icon-button" aria-label="Supprimer la sélection" onClick={handleBulkDelete}>
              <Icon name="trash" size={18} />
            </button>
          </div>
        </div>
      )}

      {bulkTagPickerOpen && (
        <div className="modal-backdrop" onClick={() => setBulkTagPickerOpen(false)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <p className="field-label" style={{ marginBottom: 12 }}>
              Ajouter un tag à {selectedIds.size} rêve(s)
            </p>
            <div className="chip-row">
              {tags.map((t) => (
                <button key={t.id} type="button" className="chip" onClick={() => handleBulkAddTag(t.id)}>
                  #{t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
