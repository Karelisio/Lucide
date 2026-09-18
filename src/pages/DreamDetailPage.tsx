import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { AudioPlayer } from "../components/AudioPlayer";
import { useAppState } from "../state/AppStateContext";
import { deleteDream, getDream } from "../db/dreamRepository";
import { deleteAudioFile } from "../audio/audioRecorder";
import type { Dream } from "../types";
import { formatShortDate } from "../utils/format";

export function DreamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { emotions, tags } = useAppState();
  const [dream, setDream] = useState<Dream | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getDream(id).then((d) => {
      setDream(d);
      setLoading(false);
    });
  }, [id]);

  async function handleDelete() {
    if (!dream) return;
    if (!confirm("Supprimer définitivement ce rêve et ses mémos audio ?")) return;
    for (const note of dream.audioNotes) {
      await deleteAudioFile(note.filePath);
    }
    await deleteDream(dream.id);
    navigate("/dreams", { replace: true });
  }

  if (loading) return <p style={{ padding: 24 }}>Chargement…</p>;
  if (!dream) {
    return (
      <div className="empty-state">
        <Icon name="moon" size={36} />
        <p>Ce rêve n'existe plus.</p>
      </div>
    );
  }

  const emotionDefs = dream.emotionIds.map((id) => emotions.find((e) => e.id === id)).filter(Boolean);
  const tagDefs = dream.tagIds.map((id) => tags.find((t) => t.id === id)).filter(Boolean);

  return (
    <div>
      <div className="top-app-bar" style={{ margin: "-16px -16px 16px" }}>
        <button className="icon-button" onClick={() => navigate(-1)} aria-label="Retour">
          <Icon name="chevron-left" />
        </button>
        <h1>{formatShortDate(dream.nightDate)}</h1>
        <div className="spacer" />
        <button className="icon-button" onClick={() => navigate(`/dreams/${dream.id}/edit`)} aria-label="Modifier">
          <Icon name="edit" />
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {dream.dreamRating !== null && <span className="badge badge-rating">Note : {dream.dreamRating}/10</span>}
        {dream.sleepQuality !== null && (
          <span className="badge">
            <Icon name="bed" size={14} /> Sommeil : {dream.sleepQuality}/5
          </span>
        )}
      </div>

      {dream.audioNotes.length > 0 && (
        <>
          <p className="section-title">Mémos vocaux</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {dream.audioNotes.map((n) => (
              <AudioPlayer key={n.id} audioNote={n} />
            ))}
          </div>
        </>
      )}

      {dream.text && (
        <>
          <p className="section-title">Récit</p>
          <p style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{dream.text}</p>
        </>
      )}

      {dream.locations.length > 0 && (
        <>
          <p className="section-title">Lieux</p>
          <div className="chip-row">
            {dream.locations.map((l) => (
              <span key={l} className="badge">{l}</span>
            ))}
          </div>
        </>
      )}

      {dream.characters.length > 0 && (
        <>
          <p className="section-title">Personnages</p>
          <div className="chip-row">
            {dream.characters.map((c) => (
              <span key={c} className="badge">{c}</span>
            ))}
          </div>
        </>
      )}

      {emotionDefs.length > 0 && (
        <>
          <p className="section-title">Émotions</p>
          <div className="chip-row">
            {emotionDefs.map((e) => (
              <span key={e!.id} className="badge">{e!.emoji} {e!.label}</span>
            ))}
          </div>
        </>
      )}

      {tagDefs.length > 0 && (
        <>
          <p className="section-title">Tags</p>
          <div className="chip-row">
            {tagDefs.map((t) => (
              <span key={t!.id} className="badge">#{t!.label}</span>
            ))}
          </div>
        </>
      )}

      <button type="button" className="btn btn-danger btn-block" style={{ marginTop: 28 }} onClick={handleDelete}>
        <Icon name="trash" size={18} />
        Supprimer ce rêve
      </button>
    </div>
  );
}
