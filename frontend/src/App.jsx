import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import TimesheetsPage from './pages/TimesheetsPage';
import TimeOffPage from './pages/TimeOffPage';
import NewTimeOffPage from './pages/NewTimeOffPage';
import WorkSchedulesPage from './pages/WorkSchedulesPage';
import HolidaysPage from './pages/HolidaysPage';
import TeamPage from './pages/TeamPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import AppLayout from './components/layout/AppLayout';
import { useAuth } from './hooks/useAuth';

function Protected({ children }) {
  const { accessToken } = useAuth();
  if (!accessToken) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { accessToken, loadMe } = useAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (accessToken) loadMe(); }, [accessToken]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="timesheets" element={<TimesheetsPage />} />
        <Route path="time-off" element={<TimeOffPage />} />
        <Route path="time-off/new" element={<NewTimeOffPage />} />
        <Route path="work-schedules" element={<WorkSchedulesPage />} />
        <Route path="holidays" element={<HolidaysPage />} />
        <Route path="team" element={<TeamPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
