import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronDown,
  Filter,
  Inbox,
  PlusCircle,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '../../api/axios';
import {
  Ticket,
  TicketStatus,
  Priority,
  TicketCategory,
} from '../../types';
import { PageHeader } from '../../components/page-header';
import { StatusBadge, PriorityBadge } from '../../components/ticket-badges';
import { UserAvatar } from '../../components/user-avatar';
import { EmptyState } from '../../components/empty-state';
import { Button } from '../../components/ui/button';
import {
  categoryLabels,
  formatRelativeRu,
  priorityLabels,
  statusLabels,
} from '../../lib/mappers';
import { cn } from '../../lib/utils';

type StatusFilter = 'all' | TicketStatus;
type PriorityFilter = 'all' | Priority;
type CategoryFilter = 'all' | TicketCategory;

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'NEW', label: statusLabels.NEW },
  { key: 'IN_PROGRESS', label: statusLabels.IN_PROGRESS },
  { key: 'WAITING', label: statusLabels.WAITING },
  { key: 'RESOLVED', label: statusLabels.RESOLVED },
  { key: 'CLOSED', label: statusLabels.CLOSED },
];

const PRIORITIES: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const CATEGORIES: TicketCategory[] = ['HARDWARE', 'SOFTWARE', 'NETWORK', 'OTHER'];

export default function TicketListPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [priority, setPriority] = useState<PriorityFilter>('all');
  const [category, setCategory] = useState<CategoryFilter>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: '1', limit: '100' });
    if (query) params.set('search', query);
    if (status !== 'all') params.set('status', status);
    if (priority !== 'all') params.set('priority', priority);
    if (category !== 'all') params.set('category', category);
    try {
      const r = await api.get<{ tickets: Ticket[]; total: number }>(`/tickets?${params}`);
      setTickets(r.data.tickets);
      setTotal(r.data.total);
    } finally {
      setLoading(false);
    }
  }, [query, status, priority, category]);

  useEffect(() => {
    const h = setTimeout(() => void load(), 200);
    return () => clearTimeout(h);
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: tickets.length,
      NEW: 0,
      IN_PROGRESS: 0,
      WAITING: 0,
      RESOLVED: 0,
      CLOSED: 0,
      REOPENED: 0,
    };
    for (const t of tickets) c[t.status]++;
    return c;
  }, [tickets]);

  const filtersDirty =
    status !== 'all' || priority !== 'all' || category !== 'all' || query.length > 0;

  const resetFilters = () => {
    setStatus('all');
    setPriority('all');
    setCategory('all');
    setQuery('');
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Заявки"
        description="Все обращения в IT-поддержку колледжа"
      >
        <Button asChild>
          <Link to="/tickets/create">
            <PlusCircle className="h-4 w-4 mr-2" />
            Создать заявку
          </Link>
        </Button>
      </PageHeader>

      {/* Status tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
        {STATUS_TABS.map((t) => {
          const active = status === t.key;
          const count = counts[t.key] ?? 0;
          return (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={cn(
                'relative inline-flex items-center gap-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              <span
                className={cn(
                  'rounded-full px-1.5 text-[10px] font-medium tabular-nums border',
                  active
                    ? 'bg-primary/15 text-primary border-primary/25'
                    : 'bg-accent/60 text-muted-foreground border-border',
                )}
              >
                {count}
              </span>
              {active && (
                <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Filters row */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            placeholder="Поиск по номеру, теме или автору..."
            className="h-10 w-full rounded-md border border-border bg-card pl-10 pr-3 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <FilterSelect
            icon={Filter}
            label="Приоритет"
            value={priority}
            onChange={(v) => setPriority(v as PriorityFilter)}
            options={[
              { value: 'all', label: 'Любой приоритет' },
              ...PRIORITIES.map((p) => ({ value: p, label: priorityLabels[p] })),
            ]}
          />
          <FilterSelect
            icon={SlidersHorizontal}
            label="Категория"
            value={category}
            onChange={(v) => setCategory(v as CategoryFilter)}
            options={[
              { value: 'all', label: 'Все категории' },
              ...CATEGORIES.map((c) => ({ value: c, label: categoryLabels[c] })),
            ]}
          />

          {filtersDirty && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs">
              Сбросить
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="rounded-md border border-border bg-card px-5 py-16 text-center text-[13px] text-muted-foreground">
          Загружаем заявки...
        </div>
      ) : tickets.length === 0 && !filtersDirty ? (
        <EmptyState
          icon={Inbox}
          title="Пока нет ни одной заявки"
          description="Как только появится первое обращение, оно отобразится здесь."
          action={{ label: 'Создать первую заявку', href: '/tickets/create' }}
        />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Ничего не найдено"
          description="Попробуйте изменить фильтры или сбросить поиск."
          action={{ label: 'Сбросить фильтры', onClick: resetFilters }}
        />
      ) : (
        <div className="rounded-md border border-border bg-card overflow-hidden">
          <div className="hidden md:grid grid-cols-[80px_140px_120px_1fr_180px_120px_100px] gap-4 px-5 py-3 border-b border-border bg-accent/30 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <div>№</div>
            <div>Статус</div>
            <div>Приоритет</div>
            <div>Заявка</div>
            <div>Исполнитель</div>
            <div>SLA</div>
            <div className="text-right">Обновлена</div>
          </div>

          <ul>
            {tickets.map((t) => (
              <li key={t.id} className="border-b border-border last:border-b-0">
                <Link
                  to={`/tickets/${t.id}`}
                  className="group grid md:grid-cols-[80px_140px_120px_1fr_180px_120px_100px] grid-cols-1 gap-4 px-5 py-4 hover:bg-accent/40 transition-colors"
                >
                  <div className="flex md:block items-center gap-2 font-mono text-xs text-muted-foreground tabular-nums">
                    #{t.ticketNumber}
                  </div>
                  <div>
                    <StatusBadge status={t.status} />
                  </div>
                  <div>
                    <PriorityBadge priority={t.priority} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-foreground group-hover:text-primary transition-colors truncate">
                      {t.subject}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="truncate">{t.creator.name}</span>
                      <span>·</span>
                      <span>{categoryLabels[t.category]}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    {t.assignee ? (
                      <>
                        <UserAvatar user={t.assignee} size={24} />
                        <span className="text-xs truncate">{t.assignee.name}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        Не назначен
                      </span>
                    )}
                  </div>
                  <div>
                    {t.slaBreached ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-danger/30 bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
                        <AlertTriangle className="h-3 w-3" />
                        Просрочен
                      </span>
                    ) : (
                      <span className="text-xs text-success">В рамках</span>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground tabular-nums font-mono">
                    {formatRelativeRu(t.updatedAt)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
            <span>
              Показано <span className="text-foreground font-medium">{tickets.length}</span> из {total}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  icon: Icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none rounded-md border border-border bg-card pl-8 pr-7 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
