import { useState } from "react";
import type { TagDef } from "../types";
import { Icon } from "./Icon";

interface TagPickerProps {
  allTags: TagDef[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onCreate: (label: string) => Promise<TagDef>;
}

export function TagPicker({ allTags, selectedIds, onToggle, onCreate }: TagPickerProps) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate() {
    const label = draft.trim();
    if (!label || busy) return;
    setBusy(true);
    try {
      const tag = await onCreate(label);
      onToggle(tag.id);
      setDraft("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="chip-row" style={{ marginBottom: 12 }}>
        {allTags.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`chip${selectedIds.includes(t.id) ? " selected" : ""}`}
            onClick={() => onToggle(t.id)}
          >
            <Icon name="tag" size={14} />
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="text-field"
          placeholder="Nouveau tag (ex: cauchemar, récurrent...)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
        />
        <button type="button" className="btn btn-tonal" onClick={handleCreate} disabled={!draft.trim() || busy}>
          Ajouter
        </button>
      </div>
    </div>
  );
}
