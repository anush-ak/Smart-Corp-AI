import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { KnowledgeChatPage } from './pages/KnowledgeChatPage';
import { MeetingConverterPage } from './pages/MeetingConverterPage';
import { TaskBoardPage } from './pages/TaskBoardPage';
import { AuditTrailPage } from './pages/AuditTrailPage';
import { Loader2 } from 'lucide-react';
import { Role } from './types';

const ProtectedLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-canvas flex flex-col items-center justify-center space-y-3">
        <Loader2 size={24} className="animate-spin text-indigo-500" strokeWidth={1.75} />
        <span className="text-xs text-zinc-500 font-mono">Loading workspace...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas text-zinc-900 dark:text-zinc-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
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
              <Route path="/knowledge" element={<KnowledgeChatPage />} />
              <Route
                path="/meetings"
                element={
                  <RoleRoute allowedRoles={['Admin', 'Manager']}>
                    <MeetingConverterPage />
                  </RoleRoute>
                }
              />
              <Route path="/tasks" element={<TaskBoardPage />} />
              <Route
                path="/audit"
                element={
                  <RoleRoute allowedRoles={['Admin', 'Manager']}>
                    <AuditTrailPage />
                  </RoleRoute>
                }
              />
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
