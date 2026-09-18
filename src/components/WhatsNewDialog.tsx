import type { ChangelogEntry } from "../changelog";
import { Icon } from "./Icon";
import { formatShortDate } from "../utils/format";

interface WhatsNewDialogProps {
  entries: ChangelogEntry[];
  onClose: () => void;
}

export function WhatsNewDialog({ entries, onClose }: WhatsNewDialogProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Nouveautés</h2>
          <div className="spacer" />
          <button type="button" className="icon-button" onClick={onClose} aria-label="Fermer">
            <Icon name="close" />
          </button>
        </div>
        {entries.map((entry) => (
          <div key={entry.version} style={{ marginBottom: 20 }}>
            <p className="field-label" style={{ marginBottom: 8 }}>
              Version {entry.version} · {formatShortDate(entry.date)}
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
              {entry.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>
        ))}
        <button type="button" className="btn btn-filled btn-block" onClick={onClose}>
          Compris
        </button>
      </div>
    </div>
  );
}
