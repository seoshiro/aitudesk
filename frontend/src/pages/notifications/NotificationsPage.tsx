import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  CircleDot,
  MessageCircle,
  RefreshCcw,
  UserCheck,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/axios';
import { useNotifStore, type Notification } from '../../store/notifStore';
import { PageHeader } from '../../components/page-header';
import { EmptyState } from '../../components/empty-state';
import { Button } from '../../components/ui/button';
import { formatRelativeRu } from '../../lib/mappers';
import { cn } from '../../lib/utils';

const TYPE_ICON: Record<string, { icon: LucideIcon; tone: string }> = {
  NEW_MESSAGE: { icon: MessageCircle, tone: 'text-info' },
  TICKET_ASSIGNED: { icon: UserCheck, tone: 'text-primary' },
  STATUS_CHANGED: { icon: RefreshCcw, tone: 'text-warning' },
  TICKET_RATED: { icon: Star, tone: 'text-warning' },
  SLA_BREACH: { icon: CircleDot, tone: 'text-danger' },
};

export default function NotificationsPage() {
  const { notifications, unreadCount, setNotifications, markRead, markAllRead } = useNotifStore();

  useEffect(() => {
    void api
      .get<{ notifications: Notification[]; unreadCount: number }>('/notifications')
      .then((r) => setNotifications(r.data.notifications, r.data.unreadCount))
      .catch(() => {});
  }, [setNotifications]);

  const handleMarkRead = async (id: string) => {
    markRead(id);
    try {
      await api.put(`/notifications/${id}/read`);
    } catch {
      /* noop */
    }
  };

  const handleMarkAllRead = async () => {
    markAllRead();
    try {
      await api.put('/notifications/read-all');
      toast.success('Все уведомления отмечены прочитанными');
    } catch {
      toast.error('Не удалось обновить статус');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Уведомления"
        description={
          unreadCount > 0
            ? `${unreadCount} непрочитанных · ${notifications.length} всего`
            : `${notifications.length} уведомлений`
        }
      >
        {unreadCount > 0 && (
          <Button variant="outline" onClick={() => void handleMarkAllRead()}>
            <CheckCheck className="h-4 w-4 mr-1.5" />
            Прочитать все
          </Button>
        )}
      </PageHeader>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Пока нет уведомлений"
          description="Как только появятся новые сообщения, назначения или изменения статусов — они отобразятся здесь."
        />
      ) : (
        <ul className="rounded-md border border-border bg-card overflow-hidden">
          {notifications.map((n) => {
            const meta = TYPE_ICON[n.type] ?? { icon: Bell, tone: 'text-muted-foreground' };
            const Icon = meta.icon;
            const body = (
              <div
                className={cn(
                  'flex items-start gap-3 px-5 py-4 hover:bg-accent/40 transition-colors',
                  !n.read && 'bg-primary/[0.03]',
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 grid h-8 w-8 place-items-center rounded-md border border-border bg-background',
                    meta.tone,
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">{n.title}</span>
                    {!n.read && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                        <CircleDot className="h-2 w-2" />
                        Новое
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[13px] text-muted-foreground line-clamp-2">
                    {n.message}
                  </div>
                  <div className="mt-1.5 text-[11px] text-muted-foreground/70 font-mono tabular-nums">
                    {formatRelativeRu(n.createdAt)}
                  </div>
                </div>
              </div>
            );
            return (
              <li key={n.id} className="border-b border-border last:border-b-0">
                {n.ticketId ? (
                  <Link
                    to={`/tickets/${n.ticketId}`}
                    onClick={() => !n.read && void handleMarkRead(n.id)}
                    className="block"
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => !n.read && void handleMarkRead(n.id)}
                    className="block w-full text-left"
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
