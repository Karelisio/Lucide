import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { StarRating } from "../components/StarRating";
import { AudioRecorderButton } from "../components/AudioRecorderButton";
import { DreamCard } from "../components/DreamCard";
import { useAppState } from "../state/AppStateContext";
import { addAudioNote, getOrCreateNightPlaceholder, listDreams, updateSleepQualityOnly } from "../db/dreamRepository";
import type { Dream } from "../types";
import { defaultNightDateForNow, formatNightLabel } from "../utils/format";
import { computeStreak } from "../utils/stats";
import type { RecordingResult } from "../audio/audioRecorder";

export function HomePage() {
  const navigate = useNavigate();
  const { emotions, tags } = useAppState();
  const [recentDreams, setRecentDreams] = useState<Dream[]>([]);
  const [streak, setStreak] = useState(0);
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const nightDate = defaultNightDateForNow();

  const emotionsById = new Map(emotions.map((e) => [e.id, e]));
  const tagsById = new Map(tags.map((t) => [t.id, t]));

  useEffect(() => {
    (async () => {
      const dreams = await listDreams();
      setRecentDreams(dreams.slice(0, 5));
      setStreak(computeStreak(dreams));
      const placeholder = dreams.find((d) => d.nightDate === nightDate);
      setSleepQuality(placeholder?.sleepQuality ?? null);
      setLoading(false);
    })();
  }, [nightDate]);

  async function handleSleepQualityChange(value: number | null) {
    setSleepQuality(value);
    const dream = await getOrCreateNightPlaceholder(nightDate);
    await updateSleepQualityOnly(dream.id, value);
  }

  async function handleRecorded(result: RecordingResult) {
    const dream = await getOrCreateNightPlaceholder(nightDate);
    await addAudioNote(dream.id, result.filePath, result.durationMs);
    navigate(`/dreams/${dream.id}/edit`);
  }

  return (
    <div>
      <div className="top-app-bar" style={{ margin: "-16px -16px 16px", background: "transparent", border: "none" }}>
        <Icon name="moon" size={26} />
        <h1>Lucide</h1>
        <div className="spacer" />
        {streak >= 2 && (
          <span
            className="badge badge-rating"
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            title="Nuits consécutives journalisées"
          >
            <Icon name="flame" size={14} /> {streak}
          </span>
        )}
      </div>

      <div className="card" style={{ textAlign: "center", marginBottom: 20 }}>
        <p className="field-label" style={{ marginBottom: 16 }}>{formatNightLabel(nightDate)}</p>
        <AudioRecorderButton onRecorded={handleRecorded} />
      </div>

      <button type="button" className="btn btn-filled btn-block" onClick={() => navigate("/dreams/new")}>
        <Icon name="add" size={20} />
        Écrire un rêve
      </button>

      <div className="card" style={{ marginTop: 20 }}>
        <p className="field-label">Qualité du sommeil cette nuit</p>
        <StarRating value={sleepQuality} onChange={handleSleepQualityChange} />
      </div>

      <p className="section-title">Rêves récents</p>
      {!loading && recentDreams.length === 0 && (
        <div className="empty-state">
          <Icon name="moon" size={36} />
          <p>Aucun rêve enregistré pour le moment.</p>
        </div>
      )}
      {recentDreams.map((d) => (
        <DreamCard key={d.id} dream={d} emotionsById={emotionsById} tagsById={tagsById} />
      ))}
    </div>
  );
}
