import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuthStore, type AuthUser } from './store/authStore';
import { api } from './api/axios';
import AppLayout from './layouts/AppLayout';
import AuthLayout from './layouts/AuthLayout';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const TicketListPage = lazy(() => import('./pages/tickets/TicketListPage'));
const TicketDetailPage = lazy(() => import('./pages/tickets/TicketDetailPage'));
const CreateTicketPage = lazy(() => import('./pages/tickets/CreateTicketPage'));
const KBListPage = lazy(() => import('./pages/kb/KBListPage'));
const KBArticlePage = lazy(() => import('./pages/kb/KBArticlePage'));
const KBEditorPage = lazy(() => import('./pages/kb/KBEditorPage'));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function ProtectedRoute({
  children,
  roles,
}: {
  children: JSX.Element;
  roles?: Array<'USER' | 'AGENT' | 'ADMIN'>;
}) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicRoute({ children }: { children: JSX.Element }) {
  const user = useAuthStore((s) => s.user);
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  );
}

export default function App() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const [checkingSession, setCheckingSession] = useState(Boolean(user));

  useEffect(() => {
    if (!user) {
      setCheckingSession(false);
      return;
    }

    let active = true;
    api.post<{ accessToken: string; user: AuthUser }>('/auth/refresh')
      .then((r) => {
        if (!active) return;
        setAuth(r.data.user, r.data.accessToken);
      })
      .catch(() => {
        if (!active) return;
        logout();
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (checkingSession) return <FullPageSpinner />;

  return (
    <BrowserRouter>
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          </Route>

          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tickets" element={<TicketListPage />} />
            <Route path="/tickets/create" element={<CreateTicketPage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
            <Route path="/kb" element={<KBListPage />} />
            <Route path="/kb/create" element={<ProtectedRoute roles={['ADMIN']}><KBEditorPage /></ProtectedRoute>} />
            <Route path="/kb/:id" element={<KBArticlePage />} />
            <Route path="/kb/:id/edit" element={<ProtectedRoute roles={['ADMIN']}><KBEditorPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/users" element={<ProtectedRoute roles={['ADMIN']}><UsersPage /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
