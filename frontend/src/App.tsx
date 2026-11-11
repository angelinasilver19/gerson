import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@shared/AppShell";
import { PublishPage } from "@publish/PublishPage";
import { AskPage } from "@discover/AskPage";
import { ToolPage } from "@discover/ToolPage";
import { DashboardPage } from "@dashboard/DashboardPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/discover" replace />} />
        <Route path="discover" element={<AskPage />} />
        <Route path="discover/tools/:toolId" element={<ToolPage />} />
        <Route path="publish" element={<PublishPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/discover" replace />} />
      </Route>
    </Routes>
  );
}
