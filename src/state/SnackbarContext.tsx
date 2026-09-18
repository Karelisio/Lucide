import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export interface SnackbarOptions {
  actionLabel?: string;
  onAction?: () => void;
  /** Durée avant disparition automatique (ms). Par défaut 4000, plus long pour un "Annuler". */
  duration?: number;
}

interface SnackbarState {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface SnackbarContextValue {
  show: (message: string, options?: SnackbarOptions) => void;
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const timerRef = useRef<number | null>(null);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setSnackbar((s) => (s && s.id === id ? null : s));
  }, []);

  const show = useCallback(
    (message: string, options: SnackbarOptions = {}) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      const id = ++idRef.current;
      setSnackbar({ id, message, actionLabel: options.actionLabel, onAction: options.onAction });
      timerRef.current = window.setTimeout(() => dismiss(id), options.duration ?? 4000);
    },
    [dismiss],
  );

  return (
    <SnackbarContext.Provider value={{ show }}>
      {children}
      {snackbar && (
        <div className="snackbar" role="status">
          <span>{snackbar.message}</span>
          {snackbar.actionLabel && (
            <button
              type="button"
              className="btn-text"
              onClick={() => {
                if (timerRef.current) window.clearTimeout(timerRef.current);
                snackbar.onAction?.();
                dismiss(snackbar.id);
              }}
            >
              {snackbar.actionLabel}
            </button>
          )}
        </div>
      )}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar(): SnackbarContextValue {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error("useSnackbar doit être utilisé sous SnackbarProvider");
  return ctx;
}
