import { useEffect } from "react";
import { HashRouter, Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { AppStateProvider, useAppState } from "./state/AppStateContext";
import { SnackbarProvider } from "./state/SnackbarContext";
import { BottomNav } from "./components/BottomNav";
import { Icon } from "./components/Icon";
import { WhatsNewGate } from "./components/WhatsNewGate";
import { HomePage } from "./pages/HomePage";
import { DreamsListPage } from "./pages/DreamsListPage";
import { DreamFormPage } from "./pages/DreamFormPage";
import { DreamDetailPage } from "./pages/DreamDetailPage";
import { StatsPage } from "./pages/StatsPage";
import { SettingsPage } from "./pages/SettingsPage";

/**
 * Intercepte les liens profonds internes (schéma io.karelisio.lucide://…), utilisés par
 * exemple par le widget d'écran d'accueil pour ouvrir directement /dreams/new, et navigue
 * dans le HashRouter en conséquence. Aucun lien web n'est concerné : c'est un mécanisme
 * interne à l'app, pas une fonctionnalité réseau.
 */
function useDeepLinks() {
  const navigate = useNavigate();
  useEffect(() => {
    const handle = CapacitorApp.addListener("appUrlOpen", ({ url }) => {
      try {
        const parsed = new URL(url);
        const target = `/${parsed.hostname}${parsed.pathname}`;
        navigate(target);
      } catch {
        // URL non reconnue : on ignore.
      }
    });
    return () => {
      handle.then((h) => h.remove());
    };
  }, [navigate]);
}

function Layout() {
  useDeepLinks();
  return (
    <div className="app-shell">
      <div className="app-content">
        <Outlet />
      </div>
      <BottomNav />
      <WhatsNewGate />
    </div>
  );
}

function Boot({ children }: { children: React.ReactNode }) {
  const { ready, initError } = useAppState();

  if (initError) {
    return (
      <div className="empty-state" style={{ paddingTop: 96 }}>
        <Icon name="moon" size={40} />
        <h2>Impossible d'ouvrir la base locale</h2>
        <p>{initError}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="empty-state" style={{ paddingTop: 96 }}>
        <Icon name="moon" size={40} />
        <p>Chargement de Lucide…</p>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AppStateProvider>
      <SnackbarProvider>
        <Boot>
          <HashRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/dreams" element={<DreamsListPage />} />
                <Route path="/dreams/new" element={<DreamFormPage />} />
                <Route path="/dreams/:id" element={<DreamDetailPage />} />
                <Route path="/dreams/:id/edit" element={<DreamFormPage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </HashRouter>
        </Boot>
      </SnackbarProvider>
    </AppStateProvider>
  );
}
