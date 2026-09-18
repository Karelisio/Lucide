import { useEffect, useRef, useState } from "react";
import { CHANGELOG, CURRENT_VERSION, type ChangelogEntry } from "../changelog";
import { getSetting, setSetting } from "../db/dreamRepository";
import { isVersionNewer } from "../utils/version";
import { WhatsNewDialog } from "./WhatsNewDialog";

const LAST_SEEN_VERSION_KEY = "last_seen_version";

export function WhatsNewGate() {
  const [pendingEntries, setPendingEntries] = useState<ChangelogEntry[] | null>(null);
  // Évite un double appel concurrent (StrictMode double-invoque les effets en dev),
  // qui ferait échouer la couche SQLite (une seule transaction à la fois).
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const lastSeen = await getSetting(LAST_SEEN_VERSION_KEY);
      if (lastSeen === null) {
        // Première installation : rien à montrer, on mémorise juste la version actuelle.
        await setSetting(LAST_SEEN_VERSION_KEY, CURRENT_VERSION);
        return;
      }
      const newEntries = CHANGELOG.filter((entry) => isVersionNewer(entry.version, lastSeen));
      if (newEntries.length > 0) {
        setPendingEntries(newEntries);
      }
    })();
  }, []);

  if (!pendingEntries) return null;

  return (
    <WhatsNewDialog
      entries={pendingEntries}
      onClose={() => {
        setSetting(LAST_SEEN_VERSION_KEY, CURRENT_VERSION);
        setPendingEntries(null);
      }}
    />
  );
}
