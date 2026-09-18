import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { startRecording, stopRecording, type RecordingResult } from "../audio/audioRecorder";
import { formatDurationMs } from "../utils/format";

interface AudioRecorderButtonProps {
  onRecorded: (result: RecordingResult) => void;
}

export function AudioRecorderButton({ onRecorded }: AudioRecorderButtonProps) {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const startedAtRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  async function handleStart() {
    setError(null);
    setBusy(true);
    try {
      await startRecording();
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

  async function handleStop() {
    setBusy(true);
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    try {
      const result = await stopRecording();
      onRecorded(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d'enregistrer.");
    } finally {
      setRecording(false);
      setBusy(false);
      setElapsedMs(0);
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
