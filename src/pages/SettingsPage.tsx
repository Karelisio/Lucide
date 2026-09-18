import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Icon } from "../components/Icon";
import { useAppState } from "../state/AppStateContext";
import { exportBackup } from "../utils/backup";
import { CHANGELOG, CURRENT_VERSION } from "../changelog";
import { formatShortDate } from "../utils/format";
import { checkForUpdate, downloadAndInstall, type AvailableUpdate } from "../utils/updateChecker";

type UpdateStatus = "idle" | "checking" | "up-to-date" | "available" | "downloading" | "error";

export function SettingsPage() {
  const { theme, setTheme, emotions, tags, addEmotion, removeEmotion, addTag, removeTag } = useAppState();
  const [newEmotionLabel, setNewEmotionLabel] = useState("");
  const [newEmotionEmoji, setNewEmotionEmoji] = useState("✨");
  const [newTagLabel, setNewTagLabel] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdate | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const canInstall = Capacitor.getPlatform() === "android";

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
      setExportMessage(
        `Sauvegarde créée : ${result.dreamCount} rêve(s), ${result.audioCount} audio(s) — dossier "${result.folder}" (accessible dans le stockage de l'application, dossier Documents).`,
      );
    } catch (e) {
      setExportMessage(e instanceof Error ? `Échec de l'export : ${e.message}` : "Échec de l'export.");
    } finally {
      setExporting(false);
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
      <div className="switch-row">
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name={theme === "dark" ? "moon" : "sun"} size={18} />
          Thème sombre
        </span>
        <button
          type="button"
          className="btn btn-tonal"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? "Activé" : "Désactivé"}
        </button>
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
          Exporte tes rêves et tes mémos audio dans un dossier local (JSON + fichiers audio), pour ne rien perdre en
          cas de changement de téléphone. Rien n'est envoyé sur internet.
        </p>
        <button type="button" className="btn btn-filled btn-block" onClick={handleExport} disabled={exporting}>
          <Icon name="download" size={18} />
          {exporting ? "Export en cours…" : "Exporter mes données"}
        </button>
        {exportMessage && (
          <p style={{ fontSize: 13, marginTop: 12, color: "var(--md-sys-color-on-surface-variant)" }}>{exportMessage}</p>
        )}
      </div>

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
