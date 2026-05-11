import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Menu, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/user-avatar';
import { Brand } from '@/components/brand';
import { useAuthStore } from '@/store/authStore';
import { useNotifStore } from '@/store/notifStore';
import { api } from '@/api/axios';

function formatTodayRu() {
  return new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function AppTopbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const unread = useNotifStore((s) => s.unreadCount);
  const navigate = useNavigate();
  const today = React.useMemo(formatTodayRu, []);

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
    <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-4 lg:px-8 border-b border-border bg-background/85 backdrop-blur-md">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 -ml-1.5 rounded-md hover:bg-accent transition-colors"
        aria-label="Меню"
      >
        <Menu className="h-5 w-5" />
      </button>

      <Link to="/dashboard" className="lg:hidden flex items-center gap-2">
        <Brand size="sm" />
      </Link>

      <div className="hidden lg:flex items-baseline gap-3 min-w-0">
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Сегодня
        </span>
        <span className="font-serif italic text-[14px] text-foreground/90 truncate">{today}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Link
          to="/notifications"
          className="relative grid h-9 w-9 place-items-center rounded border border-border bg-card hover:bg-accent transition-colors"
          aria-label="Уведомления"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} />
          {unread > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1 flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Link>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded pl-1 pr-2 h-9 border border-border bg-card hover:bg-accent transition-colors">
                <UserAvatar user={user} size={26} />
                <span className="hidden sm:block text-[12px] font-medium">
                  {user.name.split(' ')[0]}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <div className="text-sm">{user.name}</div>
                <div className="text-[11px] font-normal text-muted-foreground truncate">
                  {user.email}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile">Профиль</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/notifications">Уведомления</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void handleLogout()}>Выйти</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}
