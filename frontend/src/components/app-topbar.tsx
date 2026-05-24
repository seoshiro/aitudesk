import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Menu, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
import { languageStorageKey, supportedLanguages, type SupportedLanguage } from '@/i18n';
import { formatDate, normalizeLanguage } from '@/lib/locale';
import { cn } from '@/lib/utils';

const languageLabels: Record<SupportedLanguage, string> = {
  ru: 'RU',
  en: 'EN',
  kk: 'KZ',
};

export function AppTopbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const unread = useNotifStore((s) => s.unreadCount);
  const navigate = useNavigate();
  const currentLanguage = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const today = React.useMemo(
    () =>
      formatDate(new Date(), i18n.language, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    [i18n.language],
  );

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* noop */
    }
    logout();
    navigate('/login');
  };

  const handleLanguageChange = (lng: SupportedLanguage) => {
    window.localStorage.setItem(languageStorageKey, lng);
    void i18n.changeLanguage(lng);
  };

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-4 lg:px-8 border-b border-border bg-background/85 backdrop-blur-md">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 -ml-1.5 rounded-md hover:bg-accent transition-colors"
        aria-label={t('topbar.menu')}
      >
        <Menu className="h-5 w-5" />
      </button>

      <Link to="/dashboard" className="lg:hidden flex items-center gap-2">
        <Brand size="sm" />
      </Link>

      <div className="hidden lg:flex items-baseline gap-3 min-w-0">
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {t('common.today')}
        </span>
        <span className="font-serif italic text-[14px] text-foreground/90 truncate">{today}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div
          className="inline-flex h-9 items-center rounded border border-border bg-card p-0.5"
          aria-label={t('common.language')}
        >
          {supportedLanguages.map((lng) => (
            <button
              key={lng}
              type="button"
              onClick={() => handleLanguageChange(lng)}
              className={cn(
                'h-7 px-2.5 rounded-[3px] text-[10.5px] font-semibold tracking-[0.16em] transition-colors',
                currentLanguage === lng
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {languageLabels[lng]}
            </button>
          ))}
        </div>

        <Link
          to="/notifications"
          className="relative grid h-9 w-9 place-items-center rounded border border-border bg-card hover:bg-accent transition-colors"
          aria-label={t('topbar.notifications')}
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
                <Link to="/profile">{t('topbar.profile')}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/notifications">{t('topbar.notifications')}</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void handleLogout()}>{t('topbar.logout')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}
