import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Icon } from "../components/Icon";
import { useAppState } from "../state/AppStateContext";
import { listDreams } from "../db/dreamRepository";
import type { Dream, StatsRange } from "../types";
import { buildTimeline, computeFrequency, pearsonCorrelation } from "../utils/stats";

const RANGES: Array<{ value: StatsRange; label: string }> = [
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
  { value: "year", label: "Année" },
];

function useChartColors(theme: "dark" | "light") {
  return theme === "dark"
    ? { primary: "#C9B6FF", tertiary: "#EEB8CE", grid: "#333047", text: "#CAC4D6", surface: "#1D1B31" }
    : { primary: "#6B4CE0", tertiary: "#7C5265", grid: "#E4DFEB", text: "#48454E", surface: "#F0EBF6" };
}

export function StatsPage() {
  const { emotions, tags, theme } = useAppState();
  const colors = useChartColors(theme);
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [range, setRange] = useState<StatsRange>("month");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listDreams().then((d) => {
      setDreams(d);
      setLoading(false);
    });
  }, []);

  const timeline = useMemo(() => buildTimeline(dreams, range), [dreams, range]);
  const emotionsById = useMemo(() => new Map(emotions.map((e) => [e.id, { label: `${e.emoji} ${e.label}` }])), [emotions]);
  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, { label: t.label }])), [tags]);
  const emotionFreq = useMemo(
    () => computeFrequency(dreams, (d) => d.emotionIds, emotionsById).slice(0, 8),
    [dreams, emotionsById],
  );
  const tagFreq = useMemo(() => computeFrequency(dreams, (d) => d.tagIds, tagsById).slice(0, 8), [dreams, tagsById]);
  const correlation = useMemo(() => pearsonCorrelation(dreams), [dreams]);
  const scatterData = useMemo(
    () =>
      dreams
        .filter((d) => d.sleepQuality !== null && d.dreamRating !== null)
        .map((d) => ({ sleepQuality: d.sleepQuality, dreamRating: d.dreamRating })),
    [dreams],
  );

  const tooltipStyle = {
    background: colors.surface,
    border: `1px solid ${colors.grid}`,
    borderRadius: 12,
    color: colors.text,
    fontSize: 13,
  };

  if (loading) return <p style={{ padding: 24 }}>Chargement…</p>;

  if (dreams.length === 0) {
    return (
      <div className="empty-state">
        <Icon name="chart" size={36} />
        <p>Ajoute quelques rêves pour voir apparaître tes statistiques.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="top-app-bar" style={{ margin: "-16px -16px 16px" }}>
        <h1>Statistiques</h1>
      </div>

      <div className="segmented" style={{ marginBottom: 20 }}>
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            className={range === r.value ? "active" : ""}
            onClick={() => setRange(r.value)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="stat-card">
        <h3>Qualité du sommeil</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={timeline} margin={{ left: -20, right: 8 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" stroke={colors.text} tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 5]} stroke={colors.text} tick={{ fontSize: 11 }} width={30} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}/5`, "Sommeil"] as [string, string]} />
            <Line
              type="monotone"
              dataKey="sleepQuality"
              stroke={colors.primary}
              strokeWidth={2}
              dot={{ r: 3, fill: colors.primary }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="stat-card">
        <h3>Note des rêves</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={timeline} margin={{ left: -20, right: 8 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" stroke={colors.text} tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 10]} stroke={colors.text} tick={{ fontSize: 11 }} width={30} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}/10`, "Note"] as [string, string]} />
            <Line
              type="monotone"
              dataKey="dreamRating"
              stroke={colors.tertiary}
              strokeWidth={2}
              dot={{ r: 3, fill: colors.tertiary }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {emotionFreq.length > 0 && (
        <div className="stat-card">
          <h3>Émotions les plus fréquentes</h3>
          <ResponsiveContainer width="100%" height={Math.max(160, emotionFreq.length * 34)}>
            <BarChart data={emotionFreq} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke={colors.text} tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" stroke={colors.text} tick={{ fontSize: 12 }} width={110} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [String(v), "Occurrences"] as [string, string]} />
              <Bar dataKey="count" fill={colors.primary} radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tagFreq.length > 0 && (
        <div className="stat-card">
          <h3>Tags les plus utilisés</h3>
          <ResponsiveContainer width="100%" height={Math.max(160, tagFreq.length * 34)}>
            <BarChart data={tagFreq} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke={colors.text} tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" stroke={colors.text} tick={{ fontSize: 12 }} width={110} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [String(v), "Occurrences"] as [string, string]} />
              <Bar dataKey="count" fill={colors.primary} radius={[0, 4, 4, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="stat-card">
        <h3>Sommeil vs. note des rêves</h3>
        {scatterData.length >= 3 ? (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ left: -20, right: 16 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="sleepQuality"
                  name="Sommeil"
                  domain={[0, 5]}
                  stroke={colors.text}
                  tick={{ fontSize: 11 }}
                  label={{ value: "Qualité du sommeil", position: "insideBottom", offset: -4, fontSize: 11, fill: colors.text }}
                />
                <YAxis
                  type="number"
                  dataKey="dreamRating"
                  name="Note"
                  domain={[0, 10]}
                  stroke={colors.text}
                  tick={{ fontSize: 11 }}
                  width={30}
                />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={tooltipStyle} />
                <Scatter data={scatterData} fill={colors.primary} />
              </ScatterChart>
            </ResponsiveContainer>
            <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)", marginTop: 8 }}>
              {correlation === null
                ? "Pas encore assez de données pour calculer une corrélation."
                : `Corrélation : r = ${correlation} — ${
                    Math.abs(correlation) < 0.2
                      ? "lien très faible"
                      : Math.abs(correlation) < 0.5
                        ? "lien modéré"
                        : "lien marqué"
                  } entre sommeil et note du rêve.`}
            </p>
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
            Note à la fois la qualité du sommeil et la note du rêve sur plusieurs entrées pour voir apparaître la corrélation.
          </p>
        )}
      </div>
    </div>
  );
}
