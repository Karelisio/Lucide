import { HashRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppStateProvider, useAppState } from "./state/AppStateContext";
import { BottomNav } from "./components/BottomNav";
import { Icon } from "./components/Icon";
import { HomePage } from "./pages/HomePage";
import { DreamsListPage } from "./pages/DreamsListPage";
import { DreamFormPage } from "./pages/DreamFormPage";
import { DreamDetailPage } from "./pages/DreamDetailPage";
import { StatsPage } from "./pages/StatsPage";
import { SettingsPage } from "./pages/SettingsPage";

function Layout() {
  return (
    <div className="app-shell">
      <div className="app-content">
        <Outlet />
      </div>
      <BottomNav />
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
    </AppStateProvider>
  );
}
