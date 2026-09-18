import { useState } from "react";
import { Icon } from "./Icon";

interface ChipInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export function ChipInput({ values, onChange, placeholder }: ChipInputProps) {
  const [draft, setDraft] = useState("");

  function commit() {
    const v = draft.trim();
    if (v && !values.includes(v)) {
      onChange([...values, v]);
    }
    setDraft("");
  }

  function remove(v: string) {
    onChange(values.filter((x) => x !== v));
  }

  return (
    <div>
      {values.length > 0 && (
        <div className="chip-row" style={{ marginBottom: 10 }}>
          {values.map((v) => (
            <span key={v} className="chip selected">
              {v}
              <button
                type="button"
                onClick={() => remove(v)}
                style={{ background: "none", border: "none", display: "flex", cursor: "pointer", color: "inherit", padding: 0 }}
                aria-label={`Retirer ${v}`}
              >
                <Icon name="close" size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className="text-field"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}
