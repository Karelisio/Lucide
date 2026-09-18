import { useMemo } from "react";
import { Icon } from "./Icon";
import type { Dream } from "../types";

interface CalendarViewProps {
  month: Date;
  onMonthChange: (month: Date) => void;
  dreamsByNight: Map<string, Dream>;
  onSelectDay: (nightDate: string, dream: Dream | undefined) => void;
}

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function isoDate(d: Date): string {
  const copy = new Date(d);
  copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
  return copy.toISOString().slice(0, 10);
}

export function CalendarView({ month, onMonthChange, dreamsByNight, onSelectDay }: CalendarViewProps) {
  const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(month);
  const todayIso = isoDate(new Date());

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7; // semaine commençant le lundi
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: Array<{ date: Date; iso: string } | null> = [];
    for (let i = 0; i < startOffset; i++) out.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      out.push({ date, iso: isoDate(date) });
    }
    return out;
  }, [month]);

  function shiftMonth(delta: number) {
    onMonthChange(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button type="button" className="icon-button" onClick={() => shiftMonth(-1)} aria-label="Mois précédent">
          <Icon name="chevron-left" size={18} />
        </button>
        <span style={{ fontWeight: 500, textTransform: "capitalize" }}>{monthLabel}</span>
        <button
          type="button"
          className="icon-button"
          onClick={() => shiftMonth(1)}
          aria-label="Mois suivant"
          style={{ transform: "rotate(180deg)" }}
        >
          <Icon name="chevron-left" size={18} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 11, color: "var(--md-sys-color-on-surface-variant)" }}>
            {w}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} />;
          const dream = dreamsByNight.get(cell.iso);
          const isToday = cell.iso === todayIso;
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelectDay(cell.iso, dream)}
              style={{
                aspectRatio: "1",
                borderRadius: "50%",
                border: isToday ? "1px solid var(--md-sys-color-primary)" : "1px solid transparent",
                background: dream ? "var(--md-sys-color-secondary-container)" : "transparent",
                color: dream ? "var(--md-sys-color-on-secondary-container)" : "var(--md-sys-color-on-surface)",
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                padding: 0,
              }}
            >
              {cell.date.getDate()}
              {dream && <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor" }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
