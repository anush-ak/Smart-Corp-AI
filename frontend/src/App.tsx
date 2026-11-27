import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LayoutProvider } from './components/ui/LayoutContext';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { KnowledgeChatPage } from './pages/KnowledgeChatPage';
import { MeetingConverterPage } from './pages/MeetingConverterPage';
import { TaskBoardPage } from './pages/TaskBoardPage';
import { AuditTrailPage } from './pages/AuditTrailPage';
import { EmailWriterPage } from './pages/EmailWriterPage';
import { SmartCalendarPage } from './pages/SmartCalendarPage';
import { LeaveManagementPage } from './pages/LeaveManagementPage';
import { TeamManagementPage } from './pages/TeamManagementPage';
import { SettingsPage } from './pages/SettingsPage';
import { Loader2 } from 'lucide-react';
import { Role } from './types';

const ProtectedLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-canvas flex flex-col items-center justify-center space-y-3">
        <Loader2 size={24} className="animate-spin text-indigo-500" strokeWidth={1.75} />
        <span className="text-xs text-text-muted font-mono">Loading workspace...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <LayoutProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-canvas text-text-primary">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Outlet />
        </div>
      </div>
    </LayoutProvider>
  );
};

const RoleRoute: React.FC<{ allowedRoles: Role[]; children: React.ReactNode }> = ({
  allowedRoles,
  children,
}) => {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Application Shell */}
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/tasks" element={<TaskBoardPage />} />
              <Route path="/calendar" element={<SmartCalendarPage />} />
              <Route path="/knowledge" element={<KnowledgeChatPage />} />
              <Route path="/company-brain" element={<Navigate to="/knowledge" replace />} />
              <Route
                path="/meetings"
                element={
                  <RoleRoute allowedRoles={['Admin', 'Manager']}>
                    <MeetingConverterPage />
                  </RoleRoute>
                }
              />
              <Route path="/email-writer" element={<EmailWriterPage />} />
              <Route path="/leaves" element={<LeaveManagementPage />} />
              <Route path="/team" element={<TeamManagementPage />} />
              <Route
                path="/audit"
                element={
                  <RoleRoute allowedRoles={['Admin', 'Manager']}>
                    <AuditTrailPage />
                  </RoleRoute>
                }
              />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/profile" element={<SettingsPage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
