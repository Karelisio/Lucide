import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Icon } from "./Icon";
import {
  discardOrphanRecording,
  discardRecording,
  startRecording,
  stopRecording,
  type RecordingResult,
} from "../audio/audioRecorder";
import { formatDurationMs } from "../utils/format";

interface AudioRecorderButtonProps {
  onRecorded: (result: RecordingResult) => void;
}

export function AudioRecorderButton({ onRecorded }: AudioRecorderButtonProps) {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Occupé dès le montage, le temps de libérer un éventuel enregistrement orphelin.
  const [busy, setBusy] = useState(true);
  const startedAtRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);
  // Le nettoyage au démontage et l'écouteur natif ne voient pas les états React à jour :
  // l'état de l'enregistrement et le dernier `onRecorded` passent par des refs.
  const mountedRef = useRef(false);
  const recordingRef = useRef(false);
  const onRecordedRef = useRef(onRecorded);

  useEffect(() => {
    onRecordedRef.current = onRecorded;
  });

  const handleStop = useCallback(async () => {
    // Déjà arrêté (ex. Stop puis passage en arrière-plan) : rien à livrer deux fois.
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setBusy(true);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    try {
      const result = await stopRecording();
      onRecordedRef.current(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'enregistrer.");
    } finally {
      setRecording(false);
      setBusy(false);
      setElapsedMs(0);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;
    // Un enregistrement natif resté actif sans écran (WebView rechargée…) bloquerait le micro.
    discardOrphanRecording().finally(() => {
      if (!cancelled) setBusy(false);
    });
    return () => {
      cancelled = true;
      mountedRef.current = false;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (recordingRef.current) {
        // Écran quitté sans terminer l'enregistrement : on coupe le micro et on jette le fichier.
        recordingRef.current = false;
        discardRecording();
      }
    };
  }, []);

  useEffect(() => {
    // Passage en arrière-plan : on arrête et on livre l'enregistrement normalement (rien n'est
    // perdu) plutôt que de laisser le micro ouvert hors de l'app.
    const handle = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) handleStop();
    });
    return () => {
      handle.then((h) => h.remove());
    };
  }, [handleStop]);

  async function handleStart() {
    setError(null);
    setBusy(true);
    try {
      await startRecording();
      if (!mountedRef.current) {
        // Écran quitté pendant le démarrage : plus personne pour arrêter cet enregistrement.
        await discardRecording();
        return;
      }
      recordingRef.current = true;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setRecording(true);
      intervalRef.current = window.setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de démarrer l'enregistrement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <button
        type="button"
        className={`record-fab${recording ? " recording" : ""}`}
        onClick={recording ? handleStop : handleStart}
        disabled={busy}
        aria-label={recording ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement"}
      >
        <Icon name={recording ? "stop" : "mic"} size={32} />
      </button>
      <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
        {recording ? formatDurationMs(elapsedMs) : "Appuyer pour enregistrer un mémo vocal"}
      </p>
      {error && <p style={{ fontSize: 13, color: "var(--md-sys-color-error)" }}>{error}</p>}
    </div>
  );
}
