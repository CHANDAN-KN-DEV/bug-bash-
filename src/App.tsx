import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { Login } from './components/Login';
const ExamProvider = lazy(() => import('./context/ExamContext').then(module => ({ default: module.ExamProvider })));
const Navbar = lazy(() => import('./components/Navbar').then(module => ({ default: module.Navbar })));
const AdminPortal = lazy(() => import('./components/admin/AdminPortal').then(module => ({ default: module.AdminPortal })));
const StudentPortal = lazy(() => import('./components/student/StudentPortal').then(module => ({ default: module.StudentPortal })));
import { TeamRegistration } from './components/team/TeamRegistration';
import { TeamLogin } from './components/team/TeamLogin';
const TeamDashboard = lazy(() => import('./components/team/TeamDashboard').then(module => ({ default: module.TeamDashboard })));
import { AdminLogin } from './components/admin/AdminLogin';

const ExamExperience: React.FC<React.PropsWithChildren> = ({ children }) => (
  <Suspense fallback={<div className="p-6 text-sm text-slate-500" role="status">Loading arena…</div>}>
    <ExamProvider>{children}</ExamProvider>
  </Suspense>
);

const LegacyPortal: React.FC = () => {
  const { isAuthenticated, role } = useAuth();

  if (!isAuthenticated) {
    return <TeamRegistration />;
  }
  if (role === 'team') return <Navigate to="/team/dashboard" replace />;

  return (
    <ExamExperience>
      {role === 'admin' ? <Suspense fallback={<div className="p-6 text-sm text-slate-500" role="status">Loading admin portal…</div>}><AdminPortal /></Suspense> :
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
          <Navbar />
          <div className="flex-1">
            <Suspense fallback={<div className="p-6 text-sm text-slate-500" role="status">Loading portal…</div>}>
              <StudentPortal />
            </Suspense>
          </div>
        </div>}
    </ExamExperience>
  );
};

const TeamRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/team/login" replace />;
  if (role !== 'team') return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  if (role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
};

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/register" element={<TeamRegistration />} />
    <Route path="/team/login" element={<TeamLogin />} />
    <Route path="/team/dashboard" element={<TeamRoute><Suspense fallback={<main className="min-h-screen bg-slate-950 p-8 text-slate-300" role="status">Loading team arena…</main>}><TeamDashboard /></Suspense></TeamRoute>} />
    <Route path="/admin/login" element={<AdminLogin />} />
    <Route path="/admin/dashboard" element={<AdminRoute><ExamExperience><Suspense fallback={<div className="p-6 text-sm text-slate-500" role="status">Loading admin portal…</div>}><AdminPortal /></Suspense></ExamExperience></AdminRoute>} />
    <Route path="*" element={<LegacyPortal />} />
  </Routes>
);

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
