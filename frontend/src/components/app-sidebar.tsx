import { NavLink, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Ticket,
  BookOpen,
  Users,
  Bell,
  User as UserIcon,
  LogOut,
  PlusCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Brand } from '@/components/brand';
import { UserAvatar } from '@/components/user-avatar';
import { useAuthStore } from '@/store/authStore';
import { useNotifStore } from '@/store/notifStore';
import { getRoleLabelKey } from '@/lib/mappers';

type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  badge?: string | number;
};

const mainNav = (unread: number): NavItem[] => [
  { href: '/dashboard', labelKey: 'sidebar.dashboard', icon: LayoutDashboard },
  { href: '/tickets', labelKey: 'sidebar.tickets', icon: Ticket },
  { href: '/tickets/create', labelKey: 'sidebar.newTicket', icon: PlusCircle },
  { href: '/kb', labelKey: 'sidebar.kb', icon: BookOpen },
  {
    href: '/notifications',
    labelKey: 'sidebar.notifications',
    icon: Bell,
    badge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
  },
];

const adminNav: NavItem[] = [
  { href: '/users', labelKey: 'sidebar.users', icon: Users },
  { href: '/kb/create', labelKey: 'sidebar.newArticle', icon: PlusCircle },
];

const accountNav: NavItem[] = [{ href: '/profile', labelKey: 'sidebar.profile', icon: UserIcon }];

export function AppSidebar({ onNavigate, onLogout }: { onNavigate?: () => void; onLogout: () => void }) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const unread = useNotifStore((s) => s.unreadCount);

  return (
    <aside className="flex h-full w-full flex-col bg-sidebar">
      <div className="px-6 pt-7 pb-5">
        <Link to="/dashboard" className="block" onClick={onNavigate}>
          <Brand size="md" />
        </Link>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Service Desk
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/70 tabular-nums">v2.0</span>
        </div>
        <div className="mt-3 h-px bg-foreground/70" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-1">
        <SidebarSection label="01" title={t('sidebar.main')}>
          {mainNav(unread).map((item) => (
            <SidebarLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </SidebarSection>

        {user?.role === 'ADMIN' ? (
          <SidebarSection label="02" title={t('sidebar.admin')}>
            {adminNav.map((item) => (
              <SidebarLink key={item.href} item={item} onNavigate={onNavigate} />
            ))}
          </SidebarSection>
        ) : null}

        <SidebarSection label={user?.role === 'ADMIN' ? '03' : '02'} title={t('sidebar.account')}>
          {accountNav.map((item) => (
            <SidebarLink key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </SidebarSection>
      </nav>

      <div className="px-6 py-4 border-t border-sidebar-border">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {t('sidebar.itDept')}
        </div>
        <div className="mt-2 space-y-0.5 text-[12px] leading-snug">
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">{t('sidebar.extension')}</span>
            <span className="font-mono tabular-nums text-foreground">1212</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground">email</span>
            <span className="font-mono text-foreground truncate">it@aitu.edu.kz</span>
          </div>
        </div>
      </div>

      {user ? (
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5">
            <UserAvatar user={user} size={34} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{user.name}</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {t(getRoleLabelKey(user.role))}
              </div>
            </div>
            <button
              onClick={onLogout}
              className="grid h-8 w-8 place-items-center rounded text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
              aria-label={t('sidebar.logout')}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function SidebarSection({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6 last:mb-0 px-1">
      <div className="flex items-baseline gap-2 px-2 pb-2 mt-2">
        <span className="font-mono text-[10px] text-muted-foreground/60 tabular-nums">{label}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/80">
          {title}
        </span>
      </div>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

// Sub-routes that are listed separately in the sidebar, so their parent must
// not highlight when one of these is active.
const SIBLING_EXCLUSIONS: Record<string, string[]> = {
  '/tickets': ['/tickets/create'],
  '/kb': ['/kb/create'],
};

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const Icon = item.icon;
  const { pathname } = useLocation();

  // Exact match for routes without children in the sidebar.
  const isExactOnly =
    item.href === '/dashboard' ||
    item.href === '/tickets/create' ||
    item.href === '/kb/create' ||
    item.href === '/notifications' ||
    item.href === '/profile' ||
    item.href === '/users';

  const exclusions = SIBLING_EXCLUSIONS[item.href] ?? [];
  const active = isExactOnly
    ? pathname === item.href
    : (pathname === item.href || pathname.startsWith(`${item.href}/`)) &&
      !exclusions.some((ex) => pathname === ex || pathname.startsWith(`${ex}/`));

  return (
    <li>
      <NavLink
        to={item.href}
        end={isExactOnly}
        onClick={onNavigate}
        className={cn(
          'group flex items-center gap-3 rounded px-3 py-2 text-[13.5px] transition-colors',
          active
            ? 'bg-sidebar-accent text-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60',
        )}
      >
        <Icon
          className={cn('h-[15px] w-[15px] shrink-0', active ? 'text-primary' : 'text-muted-foreground')}
          strokeWidth={active ? 2 : 1.75}
        />
        <span className="truncate flex-1">{t(item.labelKey)}</span>
        {item.badge ? (
          <span
            className={cn(
              'font-mono tabular-nums text-[10px]',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {item.badge}
          </span>
        ) : null}
      </NavLink>
    </li>
  );
}
