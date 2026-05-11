import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Lock,
  MapPin,
  Paperclip,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Send,
  Tag,
  User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/axios';
import type { Ticket, TicketMessage, TicketStatus } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/button';
import { StatusBadge, PriorityBadge } from '../../components/ticket-badges';
import { UserAvatar } from '../../components/user-avatar';
import { categoryLabels, formatRelativeRu } from '../../lib/mappers';
import { cn } from '../../lib/utils';
import {
  getSocket,
  joinTicketRoom,
  leaveTicketRoom,
  sendTypingStart,
  sendTypingStop,
} from '../../socket/socket';

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user)!;
  const [ticket, setTicket]       = useState<Ticket | null>(null);
  const [messages, setMessages]   = useState<TicketMessage[]>([]);
  const [content, setContent]     = useState('');
  const [internal, setInternal]   = useState(false);
  const [sending, setSending]     = useState(false);
  const [typingName, setTypingName] = useState('');
  const [rating, setRating]       = useState(0);
  const [showRating, setShowRating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAll = useCallback(async () => {
    if (!id) return;
    const [t, m] = await Promise.all([
      api.get<Ticket>(`/tickets/${id}`),
      api.get<TicketMessage[]>(`/tickets/${id}/messages`),
    ]);
    setTicket(t.data);
    setMessages(m.data);
  }, [id]);

  useEffect(() => {
    void loadAll();
    if (!id) return;
    joinTicketRoom(id);
    const socket = getSocket();
    if (socket) {
      socket.on('message:new', (msg: TicketMessage) => {
        if (msg.author.id === user.id) return;
        setMessages((prev) => [...prev, msg]);
      });
      socket.on('ticket:status', (updated: Ticket) => {
        setTicket(updated);
      });
      socket.on('typing:start', (data: { userName: string; userId: string }) => {
        if (data.userId !== user.id) setTypingName(data.userName);
      });
      socket.on('typing:stop', () => setTypingName(''));
    }
    return () => {
      leaveTicketRoom(id);
      socket?.off('message:new');
      socket?.off('ticket:status');
      socket?.off('typing:start');
      socket?.off('typing:stop');
    };
  }, [id, loadAll, user.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket) return;
    setTicket(prev => prev ? { ...prev, status: newStatus as Ticket['status'] } : null);
    try {
      const r = await api.put<Ticket>(`/tickets/${ticket.id}/status`, { status: newStatus });
      setTicket(r.data);
      toast.success('Статус обновлён');
      if (newStatus === 'CLOSED') setShowRating(true);
    } catch {
      void loadAll();
      toast.error('Ошибка при смене статуса');
    }
  };

  const handleSend = async () => {
    if (!ticket || !content.trim()) return;
    setSending(true);
    const optimistic: TicketMessage = {
      id: 'tmp-' + Date.now(),
      content: content.trim(),
      type: internal ? 'INTERNAL' : 'PUBLIC',
      readBy: [],
      createdAt: new Date().toISOString(),
      author: { id: user.id, name: user.name, role: user.role, avatarUrl: user.avatarUrl },
    };
    setMessages(prev => [...prev, optimistic]);
    setContent('');
    try {
      await api.post(`/tickets/${ticket.id}/messages`, { content: optimistic.content, type: optimistic.type });
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      toast.error('Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (val: string) => {
    setContent(val);
    sendTypingStart(id!);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => sendTypingStop(id!), 1500);
  };

  const handleRate = async () => {
    if (!ticket || rating === 0) return;
    await api.post(`/tickets/${ticket.id}/rate`, { score: rating });
    toast.success('Спасибо за оценку!');
    setShowRating(false);
  };

  if (!ticket) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const canSeeInternal = user.role !== 'USER';
  const transitions = getAvailableTransitions(user.role, ticket.status);

  const formatDateTimeRu = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const visibleMessages = messages.filter((m) => canSeeInternal || m.type !== 'INTERNAL');

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-5">
        <Link to="/tickets" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
          <ChevronLeft className="h-3.5 w-3.5" />К списку заявок
        </Link>
        <span>/</span>
        <span className="font-mono">#{ticket.ticketNumber}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_480px] xl:grid-cols-[1fr_560px] gap-5">
        <section className="space-y-4 min-w-0">
          <div className="rounded-md border border-border bg-card p-6">
            <div className="flex items-start gap-3 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground pt-1">#{ticket.ticketNumber}</span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                <Tag className="h-3 w-3" />
                {categoryLabels[ticket.category]}
              </span>
            </div>
            <h1 className="mt-4 font-serif text-2xl tracking-[-0.01em] text-balance leading-tight">{ticket.subject}</h1>
            {transitions.length > 0 && (
              <div className="mt-5 flex items-center gap-2 flex-wrap">
                {transitions.map((tr) => (
                  <Button key={tr.newStatus} size="sm" variant={tr.primary ? 'default' : 'outline'} onClick={() => void handleStatusChange(tr.newStatus)} className="h-8">
                    <tr.icon className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.75} />
                    {tr.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border border-border bg-card p-6">
            <h2 className="text-sm font-semibold">Детали</h2>
            <dl className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4 text-sm">
              <Meta icon={UserIcon} label="Автор">
                <div className="flex items-center gap-2 min-w-0">
                  <UserAvatar user={ticket.creator} size={24} />
                  <span className="truncate">{ticket.creator.name}</span>
                </div>
              </Meta>
              <Meta icon={UserIcon} label="Исполнитель">
                {ticket.assignee ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <UserAvatar user={ticket.assignee} size={24} />
                    <span className="truncate">{ticket.assignee.name}</span>
                  </div>
                ) : (
                  <span className="italic text-muted-foreground">Не назначен</span>
                )}
              </Meta>
              <Meta icon={Tag} label="Категория">
                <span>{categoryLabels[ticket.category]}</span>
              </Meta>
              <Meta icon={Calendar} label="Создана">
                <span>{formatDateTimeRu(ticket.createdAt)}</span>
              </Meta>
              <Meta icon={Clock} label="SLA">
                {ticket.slaDeadlineResolve ? (
                  <span className={cn(ticket.slaBreached ? 'text-danger' : 'text-success')}>
                    {ticket.slaBreached ? 'Просрочено' : `до ${formatDateTimeRu(ticket.slaDeadlineResolve)}`}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </Meta>
              <Meta icon={MapPin} label="Обновлена">
                <span>{formatRelativeRu(ticket.updatedAt)}</span>
              </Meta>
            </dl>
          </div>

          <div className="rounded-md border border-border bg-card p-6">
            <h2 className="text-sm font-semibold">Описание</h2>
            <p className="mt-3 text-sm text-foreground/90 leading-relaxed whitespace-pre-line text-pretty">
              {ticket.description}
            </p>
          </div>

          {showRating && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-6">
              <h3 className="text-sm font-semibold">Оцените работу специалиста</h3>
              <div className="mt-3 flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setRating(star)} className={cn('text-2xl transition-transform hover:scale-110', star <= rating ? 'text-warning' : 'text-muted-foreground/40')}>★</button>
                ))}
              </div>
              <Button onClick={() => void handleRate()} disabled={rating === 0} size="sm" className="mt-4">Отправить оценку</Button>
            </div>
          )}
        </section>

        <aside className="lg:sticky lg:top-[72px] h-[calc(100dvh-120px)] min-w-0">
          <div className="h-full rounded-md border border-border bg-card flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                {ticket.assignee ? <UserAvatar user={ticket.assignee} size={34} /> : (
                  <div className="grid h-[34px] w-[34px] place-items-center rounded-full bg-secondary border border-border">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">Диалог</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                    {ticket.assignee ? `${ticket.assignee.name.split(' ')[0]} — исполнитель` : 'Ожидает исполнителя'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {visibleMessages.length === 0 ? (
                <div className="h-full grid place-items-center text-center px-4">
                  <div>
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary border border-border">
                      <Send className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <h3 className="mt-4 text-sm font-medium">Диалог пока пуст</h3>
                    <p className="mt-1 text-xs text-muted-foreground max-w-[220px] mx-auto leading-relaxed">
                      Напишите первое сообщение — автор заявки получит уведомление.
                    </p>
                  </div>
                </div>
              ) : (
                visibleMessages.map((m) => (
                  <MessageBubble key={m.id} msg={m} alignRight={m.author.id === user.id} />
                ))
              )}
              {typingName && (
                <div className="flex items-end gap-2">
                  <div className="grid h-[26px] w-[26px] place-items-center rounded-full bg-secondary border border-border" />
                  <div className="rounded-md bg-secondary border border-border px-3 py-2 text-xs text-muted-foreground">
                    {typingName} печатает…
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {ticket.status !== 'CLOSED' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend();
                }}
                className={cn('border-t border-border p-3', internal && 'bg-warning/5')}
              >
                {canSeeInternal && (
                  <label className="mb-2 flex items-center gap-2 text-[11px] select-none cursor-pointer">
                    <span
                      className={cn(
                        'relative inline-flex h-4 w-7 rounded-full border transition-colors',
                        internal ? 'bg-warning/80 border-warning' : 'bg-secondary border-border',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={internal}
                        onChange={(e) => setInternal(e.target.checked)}
                        className="sr-only"
                      />
                      <span
                        className={cn(
                          'absolute top-0.5 h-3 w-3 rounded-full bg-background transition-transform',
                          internal ? 'translate-x-3' : 'translate-x-0.5',
                        )}
                      />
                    </span>
                    <span className={cn(internal ? 'text-warning' : 'text-muted-foreground')}>
                      <Lock className="inline h-2.5 w-2.5 mr-1" />
                      Внутренняя заметка {internal ? '(видна только агентам)' : ''}
                    </span>
                  </label>
                )}
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-md border border-border bg-background hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="Прикрепить файл"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <textarea
                    value={content}
                    onChange={(e) => handleTyping(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    rows={1}
                    placeholder={internal ? 'Внутренняя заметка для агентов...' : 'Написать сообщение...'}
                    className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring min-h-[36px] max-h-24"
                  />
                  <button
                    type="submit"
                    disabled={sending || !content.trim()}
                    className="grid h-9 w-9 place-items-center rounded-md bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground transition-colors"
                    aria-label="Отправить"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-1.5 text-[10px] text-muted-foreground/70">
                  Enter — отправить · Shift+Enter — новая строка
                </div>
              </form>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

type TransitionAction = {
  label: string;
  newStatus: TicketStatus;
  icon: React.ElementType;
  primary?: boolean;
};

function getAvailableTransitions(role: 'USER' | 'AGENT' | 'ADMIN', status: TicketStatus): TransitionAction[] {
  if (role === 'USER') {
    if (status === 'RESOLVED') {
      return [
        { label: 'Подтвердить решение', newStatus: 'CLOSED', icon: CheckCircle2, primary: true },
        { label: 'Переоткрыть', newStatus: 'REOPENED', icon: RotateCcw },
      ];
    }
    return [];
  }
  if (role === 'AGENT') {
    const actions: TransitionAction[] = [];
    if (['NEW', 'WAITING', 'REOPENED'].includes(status)) {
      actions.push({ label: 'Взять в работу', newStatus: 'IN_PROGRESS', icon: PlayCircle, primary: true });
    }
    if (status === 'IN_PROGRESS') {
      actions.push({ label: 'Ожидание', newStatus: 'WAITING', icon: PauseCircle });
    }
    if (['IN_PROGRESS', 'WAITING'].includes(status)) {
      actions.push({ label: 'Решено', newStatus: 'RESOLVED', icon: CheckCircle2 });
    }
    return actions;
  }
  // ADMIN
  return [
    { label: 'В работу', newStatus: 'IN_PROGRESS', icon: PlayCircle },
    { label: 'Ожидание', newStatus: 'WAITING', icon: PauseCircle },
    { label: 'Решено', newStatus: 'RESOLVED', icon: CheckCircle2 },
  ];
}

function Meta({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </dt>
      <dd className="mt-1.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function MessageBubble({ msg, alignRight }: { msg: TicketMessage; alignRight: boolean }) {
  const time = new Date(msg.createdAt).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const avatarUser = {
    id: msg.author.id,
    name: msg.author.name,
    avatarUrl: msg.author.avatarUrl ?? null,
  };

  if (msg.type === 'INTERNAL') {
    return (
      <div className="flex items-start gap-2">
        <UserAvatar user={avatarUser} size={28} />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-muted-foreground mb-1">
            <span className="font-medium text-foreground">{msg.author.name}</span>
          </div>
          <div className="rounded-sm border-l-2 border-warning bg-warning/10 px-3.5 py-2.5 text-sm text-foreground max-w-[85%]">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-warning mb-1.5">
              <Lock className="h-2.5 w-2.5" />
              Внутренняя заметка
            </div>
            <div className="whitespace-pre-line">{msg.content}</div>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground/70">{time}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-end gap-2', alignRight && 'flex-row-reverse')}>
      <UserAvatar user={avatarUser} size={28} />
      <div className={cn('max-w-[78%] min-w-0', alignRight ? 'items-end' : 'items-start')}>
        {!alignRight && (
          <div className="mb-1 text-[11px] text-muted-foreground font-medium">{msg.author.name}</div>
        )}
        <div
          className={cn(
            'rounded-md px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line break-words',
            alignRight
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-secondary text-foreground border border-border rounded-bl-sm',
          )}
        >
          {msg.content}
        </div>
        <div
          className={cn(
            'mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/80',
            alignRight && 'justify-end',
          )}
        >
          {time}
        </div>
      </div>
    </div>
  );
}
