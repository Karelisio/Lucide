import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { getPlayableUrl } from "../audio/audioRecorder";
import type { AudioNote } from "../types";
import { formatDurationMs } from "../utils/format";

interface AudioPlayerProps {
  audioNote: AudioNote;
  onDelete?: () => void;
}

export function AudioPlayer({ audioNote, onDelete }: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPlayableUrl(audioNote.filePath)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [audioNote.filePath]);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play().catch(() => setLoadError(true));
    }
  }

  return (
    <div className="audio-row">
      <button
        type="button"
        className="icon-button"
        onClick={toggle}
        disabled={!url}
        aria-label={playing ? "Pause" : "Lecture"}
      >
        <Icon name={playing ? "pause" : "play"} size={20} />
      </button>
      <div className="grow">
        {loadError ? "Fichier audio introuvable" : `Mémo vocal · ${formatDurationMs(audioNote.durationMs)}`}
      </div>
      {url && (
        <audio
          ref={audioRef}
          src={url}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => setLoadError(true)}
        />
      )}
      {onDelete && (
        <button type="button" className="icon-button" onClick={onDelete} aria-label="Supprimer l'audio">
          <Icon name="trash" size={18} />
        </button>
      )}
    </div>
  );
}
