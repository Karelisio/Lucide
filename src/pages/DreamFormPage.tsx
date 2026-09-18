import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ChipInput } from "../components/ChipInput";
import { EmotionChips } from "../components/EmotionChips";
import { TagPicker } from "../components/TagPicker";
import { RatingSlider } from "../components/RatingSlider";
import { StarRating } from "../components/StarRating";
import { AudioRecorderButton } from "../components/AudioRecorderButton";
import { AudioPlayer } from "../components/AudioPlayer";
import { useAppState } from "../state/AppStateContext";
import {
  addAudioNote,
  createDream,
  deleteAudioNoteRow,
  deleteDream,
  getDream,
  updateDream,
} from "../db/dreamRepository";
import { deleteAudioFile } from "../audio/audioRecorder";
import type { AudioNote, DreamFormValues } from "../types";
import { defaultNightDateForNow } from "../utils/format";

const emptyForm: DreamFormValues = {
  nightDate: defaultNightDateForNow(),
  text: "",
  locations: [],
  characters: [],
  emotionIds: [],
  tagIds: [],
  dreamRating: null,
  sleepQuality: null,
};

export function DreamFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { emotions, tags, addTag } = useAppState();

  const [form, setForm] = useState<DreamFormValues>(emptyForm);
  const [audioNotes, setAudioNotes] = useState<AudioNote[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const dream = await getDream(id);
      if (dream) {
        setForm({
          nightDate: dream.nightDate,
          text: dream.text,
          locations: dream.locations,
          characters: dream.characters,
          emotionIds: dream.emotionIds,
          tagIds: dream.tagIds,
          dreamRating: dream.dreamRating,
          sleepQuality: dream.sleepQuality,
        });
        setAudioNotes(dream.audioNotes);
      }
      setLoading(false);
    })();
  }, [id]);

  function update<K extends keyof DreamFormValues>(key: K, value: DreamFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleEmotion(emotionId: string) {
    setForm((f) => ({
      ...f,
      emotionIds: f.emotionIds.includes(emotionId)
        ? f.emotionIds.filter((e) => e !== emotionId)
        : [...f.emotionIds, emotionId],
    }));
  }

  function toggleTag(tagId: string) {
    setForm((f) => ({
      ...f,
      tagIds: f.tagIds.includes(tagId) ? f.tagIds.filter((t) => t !== tagId) : [...f.tagIds, tagId],
    }));
  }

  async function handleRecorded(result: { filePath: string; durationMs: number }) {
    if (!id) {
      // Rêve pas encore créé : on le crée d'abord pour pouvoir rattacher l'audio.
      const created = await createDream(form);
      const note = await addAudioNote(created.id, result.filePath, result.durationMs);
      setAudioNotes((a) => [...a, note]);
      navigate(`/dreams/${created.id}/edit`, { replace: true });
      return;
    }
    const note = await addAudioNote(id, result.filePath, result.durationMs);
    setAudioNotes((a) => [...a, note]);
  }

  async function handleDeleteAudio(noteId: string) {
    const removed = await deleteAudioNoteRow(noteId);
    if (removed) await deleteAudioFile(removed.filePath);
    setAudioNotes((a) => a.filter((n) => n.id !== noteId));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const saved = id ? await updateDream(id, form) : await createDream(form);
      navigate(`/dreams/${saved.id}`, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    if (!confirm("Supprimer définitivement ce rêve et ses mémos audio ?")) return;
    for (const note of audioNotes) {
      await deleteAudioFile(note.filePath);
    }
    await deleteDream(id);
    navigate("/dreams", { replace: true });
  }

  if (loading) {
    return <p style={{ padding: 24 }}>Chargement…</p>;
  }

  return (
    <div>
      <div className="top-app-bar" style={{ margin: "-16px -16px 16px" }}>
        <button className="icon-button" onClick={() => navigate(-1)} aria-label="Retour">
          <Icon name="chevron-left" />
        </button>
        <h1>{isEdit ? "Modifier le rêve" : "Nouveau rêve"}</h1>
      </div>

      <label className="field-label" htmlFor="night-date">
        Nuit du rêve
      </label>
      <input
        id="night-date"
        type="date"
        className="text-field"
        value={form.nightDate}
        onChange={(e) => update("nightDate", e.target.value)}
      />

      <p className="section-title">Mémo vocal</p>
      <AudioRecorderButton onRecorded={handleRecorded} />
      {audioNotes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
          {audioNotes.map((n) => (
            <AudioPlayer key={n.id} audioNote={n} onDelete={() => handleDeleteAudio(n.id)} />
          ))}
        </div>
      )}

      <p className="section-title">Récit du rêve</p>
      <textarea
        className="textarea-field"
        placeholder="Décris ton rêve, aussi détaillé ou fragmenté que tu t'en souviennes…"
        value={form.text}
        onChange={(e) => update("text", e.target.value)}
      />

      <p className="section-title">Lieu(x)</p>
      <ChipInput values={form.locations} onChange={(v) => update("locations", v)} placeholder="Ajouter un lieu…" />

      <p className="section-title">Personnages</p>
      <ChipInput
        values={form.characters}
        onChange={(v) => update("characters", v)}
        placeholder="Ajouter un personnage…"
      />

      <p className="section-title">Émotions ressenties</p>
      <EmotionChips emotions={emotions} selectedIds={form.emotionIds} onToggle={toggleEmotion} />

      <p className="section-title">Tags</p>
      <TagPicker allTags={tags} selectedIds={form.tagIds} onToggle={toggleTag} onCreate={addTag} />

      <p className="section-title">Note du rêve</p>
      <RatingSlider value={form.dreamRating} onChange={(v) => update("dreamRating", v)} />

      <p className="section-title">Qualité du sommeil</p>
      <StarRating value={form.sleepQuality} onChange={(v) => update("sleepQuality", v)} />

      <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12 }}>
        <button type="button" className="btn btn-filled btn-block" onClick={handleSave} disabled={saving}>
          Enregistrer
        </button>
        {isEdit && (
          <button type="button" className="btn btn-danger btn-block" onClick={handleDelete}>
            Supprimer ce rêve
          </button>
        )}
      </div>
    </div>
  );
}
