import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNotifStore } from '../store/notifStore';
import { api } from '../api/axios';
import { AppSidebar } from '../components/app-sidebar';
import { AppTopbar } from '../components/app-topbar';
import { AIAssistantWidget } from '../components/ai-assistant-widget';
import { Toaster } from '../components/ui/sonner';
import { connectSocket, disconnectSocket } from '../socket/socket';

export default function AppLayout() {
  const { user, logout } = useAuthStore();
  const setNotifications = useNotifStore((s) => s.setNotifications);
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    connectSocket();
    api
      .get<{ notifications: unknown[]; unreadCount: number }>('/notifications')
      .then((r) => {
        setNotifications(r.data.notifications as never[], r.data.unreadCount);
      })
      .catch(() => {});
    return () => {
      disconnectSocket();
    };
  }, [user, setNotifications]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* noop */
    }
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block w-[240px] shrink-0 border-r border-sidebar-border sticky top-0 h-dvh">
        <AppSidebar onLogout={() => void handleLogout()} />
      </div>

      {/* Mobile sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-200 lg:hidden border-r border-sidebar-border ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative h-full">
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-3 right-3 z-10 grid h-8 w-8 place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-accent"
            aria-label="Закрыть меню"
          >
            <X className="h-4 w-4" />
          </button>
          <AppSidebar onNavigate={() => setSidebarOpen(false)} onLogout={() => void handleLogout()} />
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <AppTopbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="px-4 lg:px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>

      <AIAssistantWidget />
      <Toaster />
    </div>
  );
}
