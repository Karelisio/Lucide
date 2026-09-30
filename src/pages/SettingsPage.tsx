import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Icon } from "../components/Icon";
import { useAppState } from "../state/AppStateContext";
import { exportBackup, restoreBackup } from "../utils/backup";
import { describeRestoreReport } from "../utils/backupFormat";
import { CHANGELOG, CURRENT_VERSION } from "../changelog";
import { formatShortDate } from "../utils/format";
import { checkForUpdate, downloadAndInstall, type AvailableUpdate } from "../utils/updateChecker";
import {
  DEFAULT_REMINDER_TIME,
  REMINDER_ENABLED_KEY,
  REMINDER_TIME_KEY,
  cancelMorningReminder,
  isExactAlarmAllowed,
  isReminderSupported,
  openExactAlarmSetting,
  parseReminderTime,
  scheduleMorningReminder,
} from "../utils/reminder";
import { getSetting, setSetting } from "../db/dreamRepository";
import type { ThemeMode } from "../types";

type UpdateStatus = "idle" | "checking" | "up-to-date" | "available" | "downloading" | "error";

const THEME_OPTIONS: Array<{ mode: ThemeMode; label: string }> = [
  { mode: "system", label: "Système" },
  { mode: "light", label: "Clair" },
  { mode: "dark", label: "Sombre" },
  { mode: "oled", label: "Noir OLED" },
];

export function SettingsPage() {
  const {
    theme,
    resolvedTheme,
    setTheme,
    dynamicColorSupported,
    dynamicColorEnabled,
    dynamicColorError,
    setDynamicColorEnabled,
    emotions,
    tags,
    refreshTaxonomy,
    addEmotion,
    removeEmotion,
    addTag,
    removeTag,
  } = useAppState();
  const [newEmotionLabel, setNewEmotionLabel] = useState("");
  const [newEmotionEmoji, setNewEmotionEmoji] = useState("✨");
  const [newTagLabel, setNewTagLabel] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdate | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const canInstall = Capacitor.getPlatform() === "android";
  const reminderSupported = isReminderSupported();
  const [reminderEnabled, setReminderEnabledState] = useState(false);
  const [reminderTime, setReminderTimeState] = useState(DEFAULT_REMINDER_TIME);
  const [reminderError, setReminderError] = useState<string | null>(null);
  // Autorisation « Alarmes et rappels » (null : pas encore connue).
  const [exactAlarmAllowed, setExactAlarmAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const enabled = await getSetting(REMINDER_ENABLED_KEY);
      const time = await getSetting(REMINDER_TIME_KEY);
      if (enabled === "1") setReminderEnabledState(true);
      if (time) setReminderTimeState(time);
      if (reminderSupported) setExactAlarmAllowed(await isExactAlarmAllowed().catch(() => null));
    })();
  }, [reminderSupported]);

  async function applyReminder(enabled: boolean, time: string): Promise<boolean> {
    setReminderError(null);
    try {
      if (enabled) {
        await scheduleMorningReminder(parseReminderTime(time));
      } else {
        await cancelMorningReminder();
      }
      return true;
    } catch (e) {
      setReminderError(e instanceof Error ? e.message : "Impossible d'activer le rappel.");
      return false;
    }
  }

  async function handleToggleReminder() {
    const next = !reminderEnabled;
    const ok = await applyReminder(next, reminderTime);
    if (!ok) return;
    setReminderEnabledState(next);
    await setSetting(REMINDER_ENABLED_KEY, next ? "1" : "0");
  }

  async function handleReminderTimeChange(time: string) {
    setReminderTimeState(time);
    await setSetting(REMINDER_TIME_KEY, time);
    if (reminderEnabled) await applyReminder(true, time);
  }

  async function handleAllowExactAlarm() {
    try {
      const allowed = await openExactAlarmSetting();
      setExactAlarmAllowed(allowed);
      // Reprogrammé en alarme exacte maintenant qu'elle est autorisée.
      if (allowed && reminderEnabled) await applyReminder(true, reminderTime);
    } catch (e) {
      setReminderError(e instanceof Error ? e.message : "Impossible d'ouvrir le réglage « Alarmes et rappels ».");
    }
  }

  async function handleAddEmotion() {
    if (!newEmotionLabel.trim()) return;
    await addEmotion(newEmotionLabel.trim(), newEmotionEmoji || "✨");
    setNewEmotionLabel("");
    setNewEmotionEmoji("✨");
  }

  async function handleAddTag() {
    if (!newTagLabel.trim()) return;
    await addTag(newTagLabel.trim());
    setNewTagLabel("");
  }

  async function handleExport() {
    setExporting(true);
    setExportMessage(null);
    try {
      const result = await exportBackup();
      const counts = `${result.dreamCount} rêve(s), ${result.audioCount} mémo(s) audio`;
      setExportMessage(
        result.downloaded
          ? `Sauvegarde téléchargée : ${result.location} (${counts}).`
          : `Sauvegarde créée : ${counts} — fichier « ${result.location} ». Pour changer de téléphone, copie ce fichier sur le nouveau, puis « Restaurer une sauvegarde ».`,
      );
    } catch (e) {
      setExportMessage(e instanceof Error ? `Échec de l'export : ${e.message}` : "Échec de l'export.");
    } finally {
      setExporting(false);
    }
  }

  async function handleRestoreFile(file: File | undefined) {
    if (!file) return;
    setRestoring(true);
    setRestoreMessage(null);
    try {
      const report = await restoreBackup(file);
      await refreshTaxonomy();
      setRestoreMessage(describeRestoreReport(report));
    } catch (e) {
      setRestoreMessage(e instanceof Error ? `Échec de la restauration : ${e.message}` : "Échec de la restauration.");
    } finally {
      setRestoring(false);
    }
  }

  async function handleCheckUpdate() {
    setUpdateStatus("checking");
    setUpdateError(null);
    try {
      const update = await checkForUpdate();
      if (update) {
        setAvailableUpdate(update);
        setUpdateStatus("available");
      } else {
        setUpdateStatus("up-to-date");
      }
    } catch (e) {
      setUpdateError(e instanceof Error ? e.message : "Vérification impossible.");
      setUpdateStatus("error");
    }
  }

  async function handleInstallUpdate() {
    if (!availableUpdate) return;
    setUpdateStatus("downloading");
    setDownloadProgress(0);
    setUpdateError(null);
    try {
      await downloadAndInstall(availableUpdate, setDownloadProgress);
      setUpdateStatus("idle");
    } catch (e) {
      setUpdateError(e instanceof Error ? e.message : "Échec de l'installation.");
      setUpdateStatus("error");
    }
  }

  return (
    <div>
      <div className="top-app-bar" style={{ margin: "-16px -16px 16px" }}>
        <h1>Réglages</h1>
      </div>

      <p className="section-title">Apparence</p>
      <div className="card">
        <span style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Icon name={resolvedTheme === "light" ? "sun" : "moon"} size={18} />
          Thème
        </span>
        <div className="segmented" style={{ display: "flex", width: "100%" }}>
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.mode}
              type="button"
              className={theme === opt.mode ? "active" : ""}
              style={{ flex: 1 }}
              onClick={() => setTheme(opt.mode)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, marginTop: 10, color: "var(--md-sys-color-on-surface-variant)" }}>
          « Système » suit le réglage clair/sombre de ton téléphone. Le noir OLED économise la batterie sur les
          écrans à diodes (une nuit par écran, littéralement).
        </p>

        {dynamicColorSupported && (
          <div className="switch-row" style={{ marginTop: 4, borderTop: "1px solid var(--md-sys-color-outline-variant)" }}>
            <span>
              Couleurs de mon fond d'écran
              <br />
              <span style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>
                Material You — Android 12 et plus
              </span>
            </span>
            <button
              type="button"
              className="btn btn-tonal"
              onClick={() => setDynamicColorEnabled(!dynamicColorEnabled)}
            >
              {dynamicColorEnabled ? "Activé" : "Désactivé"}
            </button>
          </div>
        )}
        {dynamicColorEnabled && dynamicColorError && (
          <p style={{ fontSize: 12, marginTop: 8, color: "var(--md-sys-color-error)" }}>
            {dynamicColorError} La palette par défaut de Lucide est utilisée à la place.
          </p>
        )}
      </div>

      <p className="section-title">Émotions</p>
      <div className="card">
        {emotions.map((e) => (
          <div key={e.id} className="tag-list-row">
            <span>{e.emoji} {e.label}</span>
            <button type="button" className="icon-button" onClick={() => removeEmotion(e.id)} aria-label={`Supprimer ${e.label}`}>
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            className="text-field"
            style={{ width: 56, textAlign: "center", padding: "14px 8px" }}
            value={newEmotionEmoji}
            maxLength={2}
            onChange={(e) => setNewEmotionEmoji(e.target.value)}
          />
          <input
            className="text-field"
            placeholder="Nouvelle émotion…"
            value={newEmotionLabel}
            onChange={(e) => setNewEmotionLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddEmotion()}
          />
          <button type="button" className="btn btn-tonal" onClick={handleAddEmotion} disabled={!newEmotionLabel.trim()}>
            <Icon name="add" size={18} />
          </button>
        </div>
      </div>

      <p className="section-title">Tags</p>
      <div className="card">
        {tags.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>Aucun tag pour le moment.</p>
        )}
        {tags.map((t) => (
          <div key={t.id} className="tag-list-row">
            <span>#{t.label}</span>
            <button type="button" className="icon-button" onClick={() => removeTag(t.id)} aria-label={`Supprimer ${t.label}`}>
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            className="text-field"
            placeholder="Nouveau tag…"
            value={newTagLabel}
            onChange={(e) => setNewTagLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
          />
          <button type="button" className="btn btn-tonal" onClick={handleAddTag} disabled={!newTagLabel.trim()}>
            <Icon name="add" size={18} />
          </button>
        </div>
      </div>

      <p className="section-title">Sauvegarde locale</p>
      <div className="card">
        <p style={{ fontSize: 14, marginBottom: 14, color: "var(--md-sys-color-on-surface-variant)" }}>
          Exporte tes rêves et tes mémos audio dans une archive .zip (dossier Documents/Lucide_backups du téléphone).
          C'est le seul moyen de ne rien perdre en changeant de téléphone : copie l'archive sur le nouveau, puis
          restaure-la ici. Rien n'est envoyé sur internet.
        </p>
        <button type="button" className="btn btn-filled btn-block" onClick={handleExport} disabled={exporting || restoring}>
          <Icon name="download" size={18} />
          {exporting ? "Export en cours…" : "Exporter mes données"}
        </button>
        {exportMessage && (
          <p style={{ fontSize: 13, marginTop: 12, color: "var(--md-sys-color-on-surface-variant)" }}>{exportMessage}</p>
        )}
        {/*
          Sélecteur de fichiers du système : sur un nouveau téléphone, l'app ne peut en général pas lire
          directement un fichier copié dans Documents. application/octet-stream et x-zip-compressed :
          un .zip venu d'un PC ou d'un cloud n'est pas toujours déclaré application/zip, et le sélecteur
          grise les fichiers d'un autre type. Le contenu est de toute façon vérifié à la lecture.
        */}
        <input
          ref={restoreInputRef}
          type="file"
          accept=".zip,.json,application/zip,application/x-zip-compressed,application/json,application/octet-stream"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            handleRestoreFile(file);
          }}
        />
        <button
          type="button"
          className="btn btn-tonal btn-block"
          style={{ marginTop: 12 }}
          onClick={() => restoreInputRef.current?.click()}
          disabled={exporting || restoring}
        >
          <Icon name="upload" size={18} />
          {restoring ? "Restauration en cours…" : "Restaurer une sauvegarde"}
        </button>
        <p style={{ fontSize: 12, marginTop: 8, color: "var(--md-sys-color-on-surface-variant)" }}>
          Ajoute les rêves de la sauvegarde (.zip, ou data.json d'une ancienne version, sans l'audio) sans modifier
          ceux déjà présents.
        </p>
        {restoreMessage && (
          <p style={{ fontSize: 13, marginTop: 12, color: "var(--md-sys-color-on-surface-variant)" }}>{restoreMessage}</p>
        )}
      </div>

      {reminderSupported && (
        <>
          <p className="section-title">Rappels</p>
          <div className="card">
            <div className="switch-row" style={{ border: "none", padding: "0 0 8px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="bell" size={18} />
                Rappel matinal
              </span>
              <button type="button" className="btn btn-tonal" onClick={handleToggleReminder}>
                {reminderEnabled ? "Activé" : "Désactivé"}
              </button>
            </div>
            <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)", marginBottom: reminderEnabled ? 14 : 0 }}>
              Une notification locale (jamais de réseau) pour penser à noter ton rêve avant qu'il ne s'efface.
            </p>
            {reminderEnabled && (
              <input
                type="time"
                className="text-field"
                value={reminderTime}
                onChange={(e) => handleReminderTimeChange(e.target.value)}
              />
            )}
            {reminderEnabled && exactAlarmAllowed === false && (
              <div style={{ marginTop: 14 }}>
                <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)", marginBottom: 10 }}>
                  Heure approximative : sans l'autorisation « Alarmes et rappels », Android peut décaler le rappel de
                  plusieurs minutes.
                </p>
                <button type="button" className="btn btn-tonal btn-block" onClick={handleAllowExactAlarm}>
                  Autoriser l'heure exacte
                </button>
              </div>
            )}
            {reminderError && (
              <p style={{ fontSize: 13, marginTop: 10, color: "var(--md-sys-color-error)" }}>{reminderError}</p>
            )}
          </div>
        </>
      )}

      <p className="section-title">Mises à jour</p>
      <div className="card">
        <p style={{ fontSize: 14, marginBottom: 14, color: "var(--md-sys-color-on-surface-variant)" }}>
          Lucide n'étant pas distribué via le Play Store, les mises à jour se font ici. Seule cette vérification
          manuelle contacte le réseau (l'API publique de GitHub) — jamais tes rêves.
        </p>

        {updateStatus !== "downloading" && (
          <button type="button" className="btn btn-tonal btn-block" onClick={handleCheckUpdate} disabled={updateStatus === "checking"}>
            {updateStatus === "checking" ? "Vérification…" : "Vérifier les mises à jour"}
          </button>
        )}

        {updateStatus === "up-to-date" && (
          <p style={{ fontSize: 13, marginTop: 12, color: "var(--md-sys-color-on-surface-variant)" }}>
            <Icon name="check" size={14} /> Tu as déjà la dernière version ({CURRENT_VERSION}).
          </p>
        )}

        {updateStatus === "error" && updateError && (
          <p style={{ fontSize: 13, marginTop: 12, color: "var(--md-sys-color-error)" }}>{updateError}</p>
        )}

        {updateStatus === "available" && availableUpdate && (
          <div style={{ marginTop: 16 }}>
            <p className="field-label" style={{ marginBottom: 8 }}>
              Version {availableUpdate.version} disponible
            </p>
            {availableUpdate.notes.length > 0 && (
              <ul style={{ margin: "0 0 14px", paddingLeft: 20, lineHeight: 1.6, fontSize: 14 }}>
                {availableUpdate.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            )}
            {canInstall ? (
              <button type="button" className="btn btn-filled btn-block" onClick={handleInstallUpdate}>
                <Icon name="download" size={18} />
                Télécharger et installer
              </button>
            ) : (
              <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>
                Le téléchargement et l'installation ne sont possibles que depuis l'app Android installée.
              </p>
            )}
          </div>
        )}

        {updateStatus === "downloading" && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 13, marginBottom: 8, color: "var(--md-sys-color-on-surface-variant)" }}>
              Téléchargement… {downloadProgress > 0 ? `${downloadProgress}%` : ""}
            </p>
            <div style={{ height: 6, borderRadius: 999, background: "var(--md-sys-color-surface-container-high)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${downloadProgress}%`,
                  background: "var(--md-sys-color-primary)",
                  transition: "width 0.2s",
                }}
              />
            </div>
          </div>
        )}
      </div>

      <p className="section-title">À propos</p>
      <div className="card">
        <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)", lineHeight: 1.6, marginBottom: 12 }}>
          Lucide fonctionne entièrement hors ligne. Toutes tes données (texte, tags, audio) restent stockées
          uniquement sur cet appareil, dans une base SQLite locale. Aucune donnée n'est transmise à un serveur.
        </p>
        <p style={{ fontSize: 13, color: "var(--md-sys-color-on-surface-variant)" }}>Version {CURRENT_VERSION}</p>
      </div>

      <p className="section-title">Historique des versions</p>
      <div className="card">
        {CHANGELOG.map((entry, i) => (
          <div key={entry.version} style={{ paddingTop: i === 0 ? 0 : 16, marginTop: i === 0 ? 0 : 16, borderTop: i === 0 ? "none" : "1px solid var(--md-sys-color-outline-variant)" }}>
            <p className="field-label" style={{ marginBottom: 8 }}>
              Version {entry.version} · {formatShortDate(entry.date)}
            </p>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6, fontSize: 14 }}>
              {entry.notes.map((note, j) => (
                <li key={j}>{note}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
