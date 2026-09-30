import { deleteAudioFile } from "../audio/audioRecorder";
import { purgeDeletedDreams, setDreamsDeleted } from "./dreamRepository";

/** Délai pendant lequel une suppression depuis la liste reste annulable (snackbar « Annuler »). */
export const UNDO_DELAY_MS = 4000;

const undoListeners = new Set<() => void>();

/** Supprime pour de bon les rêves marqués et leurs fichiers audio. Ne lève jamais. */
async function purge(ids?: string[]): Promise<void> {
  try {
    for (const filePath of await purgeDeletedDreams(ids)) {
      await deleteAudioFile(filePath);
    }
  } catch {
    // Rêves toujours marqués : nouvel essai au prochain démarrage.
  }
}

/**
 * Suppression annulable pendant UNDO_DELAY_MS. Les rêves sont marqués en base (deleted_at), donc
 * masqués aussitôt partout, même si l'on quitte puis rouvre la liste (ils y réapparaissaient),
 * puis supprimés pour de bon à la fin du délai, quel que soit l'écran affiché. Si l'app est tuée
 * avant (la suppression était alors perdue), finalizePendingDeletions() l'achève au démarrage.
 */
export function deleteDreamsWithUndo(ids: string[]): { undo: () => Promise<void> } {
  let settled = false;
  const marked = setDreamsDeleted(ids, true);
  const timer = window.setTimeout(() => {
    settled = true;
    marked.then(() => purge(ids), () => {});
  }, UNDO_DELAY_MS);
  return {
    undo: async () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      await marked.catch(() => {});
      await setDreamsDeleted(ids, false);
      undoListeners.forEach((listener) => listener());
    },
  };
}

/** Au démarrage : achève les suppressions interrompues (app tuée pendant le délai d'annulation). */
export function finalizePendingDeletions(): Promise<void> {
  return purge();
}

/** Prévient les écrans ouverts qu'une suppression a été annulée, pour qu'ils rechargent leur liste. */
export function onDeletionUndone(listener: () => void): () => void {
  undoListeners.add(listener);
  return () => {
    undoListeners.delete(listener);
  };
}
