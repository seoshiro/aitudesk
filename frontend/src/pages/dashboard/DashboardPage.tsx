import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Download,
  PlusCircle,
  Star,
  Ticket as TicketIcon,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../api/axios';
import { PageHeader } from '../../components/page-header';
import { StatCard } from '../../components/stat-card';
import { TicketsLineChart, CategoryDonut } from '../../components/dashboard-charts';
import { StatusBadge, PriorityBadge } from '../../components/ticket-badges';
import { UserAvatar } from '../../components/user-avatar';
import { Button } from '../../components/ui/button';
import {
  getCategoryLabelKey,
  getRoleLabelKey,
  type BackendCategory,
  type BackendPriority,
  type BackendStatus,
} from '../../lib/mappers';
import { formatCount, formatDate, formatRelative, normalizeLanguage } from '../../lib/locale';
import { cn } from '../../lib/utils';

interface DashboardStats {
  total: number;
  open?: number;
  active?: number;
  resolved: number;
  closed?: number;
  slaBreached?: number;
  avgResolutionHours?: number | string | null;
  avgRating?: number | string | null;
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

interface TicketRow {
  id: string;
  ticketNumber: number;
  subject: string;
  status: BackendStatus;
  priority: BackendPriority;
  category: BackendCategory;
  slaBreached: boolean;
  updatedAt: string;
  createdAt: string;
  creator: { id: string; name: string; email: string; avatarUrl?: string | null };
  assignee?: { id: string; name: string; email: string; avatarUrl?: string | null } | null;
}

interface AgentRow {
  id: string;
  name: string;
  avatarUrl?: string | null;
  total: number;
  resolved: number;
  avgRating: number | null;
  avgResolutionHours: number | null;
}

interface KbArticle {
  id: string;
  title: string;
  category?: string | null;
  viewCount?: number;
  createdAt: string;
}

const CATEGORY_ACCENT: Record<string, string> = {
  HARDWARE: 'oklch(0.7 0.13 70)',
  SOFTWARE: 'oklch(0.36 0.14 263)',
  NETWORK: 'oklch(0.5 0.12 155)',
  OTHER: 'oklch(0.65 0.02 260)',
};

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user)!;
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [byDay, setByDay] = useState<{ date: string; count: number }[]>([]);
  const [byCat, setByCat] = useState<{ category: string; count: number }[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [kb, setKb] = useState<KbArticle[]>([]);

  useEffect(() => {
    void api.get<DashboardStats>('/dashboard/stats').then((r) => setStats(r.data)).catch(() => {});
    void api
      .get<{ tickets: TicketRow[] }>('/tickets', { params: { page: 1, limit: 5 } })
      .then((r) => setTickets(r.data.tickets ?? []))
      .catch(() => {});
    void api
      .get<{ articles?: KbArticle[] } | KbArticle[]>('/kb/articles', {
        params: { limit: 3, lang: normalizeLanguage(i18n.language) },
      })
      .then((r) => {
        const data = r.data as KbArticle[] | { articles?: KbArticle[] };
        const list = Array.isArray(data) ? data : data.articles ?? [];
        setKb(list.slice(0, 3));
      })
      .catch(() => {});

    if (user.role !== 'USER') {
      void api
        .get<{ date: string; count: number }[]>('/dashboard/tickets-by-day')
        .then((r) => setByDay(r.data))
        .catch(() => {});
      void api
        .get<{ category: string; count: number }[]>('/dashboard/by-category')
        .then((r) => setByCat(r.data))
        .catch(() => {});
    }
    if (user.role === 'ADMIN') {
      void api.get<AgentRow[]>('/dashboard/agents').then((r) => setAgents(r.data)).catch(() => {});
    }
  }, [user.role, i18n.language]);

  const today = useMemo(
    () =>
      formatDate(new Date(), i18n.language, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [i18n.language],
  );

  const firstName = user.name.split(' ')[0];

  // ── Report download state ───────────────────────────────────────────────
  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = formatDate(d, i18n.language, { month: 'long', year: 'numeric' });
      opts.push({ value: val, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return opts;
  }, [i18n.language]);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value ?? '');
  const [downloading, setDownloading] = useState(false);

  const handleDownloadReport = async () => {
    if (!selectedMonth) return;
    setDownloading(true);
    try {
      const resp = await api.get(`/reports/monthly`, {
        params: { month: selectedMonth },
        responseType: 'blob',
      });
      const blob = new Blob([resp.data as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${selectedMonth}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // silent
    } finally {
      setDownloading(false);
    }
  };

  const spark = useMemo(() => byDay.map((d) => d.count), [byDay]);
  const sparkFallback = useMemo(() => [4, 6, 5, 7, 6, 8, 7, 9], []);

  const totalVal = stats?.total ?? 0;
  const activeVal = stats ? stats.active ?? stats.open ?? 0 : 0;
  const resolvedVal = stats?.resolved ?? 0;
  const slaVal = stats ? stats.slaBreached ?? stats.closed ?? 0 : 0;

  const categoryBreakdown = useMemo(() => {
    const total = byCat.reduce((s, d) => s + d.count, 0) || 1;
    return byCat.map((d) => ({
      name: t(getCategoryLabelKey(d.category as BackendCategory), { defaultValue: d.category }),
      value: Math.round((d.count / total) * 100),
      fill: CATEGORY_ACCENT[d.category] ?? 'oklch(0.55 0.17 27)',
    }));
  }, [byCat, t]);

  const title =
    user.role === 'USER' ? t('dashboard.userTitle', { name: firstName }) : t('dashboard.supportTitle');
  const description =
    user.role === 'USER'
      ? t('dashboard.userDescription')
      : user.role === 'AGENT'
        ? t('dashboard.agentDescription')
        : t('dashboard.adminDescription');

  const recentTitle =
    user.role === 'USER'
      ? t('dashboard.recent.user')
      : user.role === 'AGENT'
        ? t('dashboard.recent.agent')
        : t('dashboard.recent.admin');

  return (
    <div className="space-y-12 max-w-[1480px] mx-auto">
      <PageHeader eyebrow={`${t('common.issue')} · ${today}`} title={title} description={description}>
        <div className="hidden sm:inline-flex items-center gap-2 h-9 px-3 rounded border border-border bg-card text-[12px] leading-none">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span className="text-muted-foreground">{t('dashboard.systems')}</span>
          <span className="font-medium">{t('dashboard.systemsOk')}</span>
        </div>
        <Button asChild className="rounded">
          <Link to="/tickets/create">
            <PlusCircle className="h-4 w-4" strokeWidth={1.75} />
            {t('common.createTicket')}
          </Link>
        </Button>
      </PageHeader>

      {/* Report Download */}
      {user.role !== 'USER' && (
        <section>
          <SectionTitle label="00" title={t('dashboard.report.title')} caption="PDF" />
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 rounded border border-border bg-card px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring/50"
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <Button
              onClick={handleDownloadReport}
              disabled={downloading}
              variant="outline"
              className="rounded"
            >
              <Download className="h-4 w-4 mr-2" strokeWidth={1.75} />
              {downloading ? t('dashboard.report.downloading') : t('dashboard.report.download')}
            </Button>
          </div>
        </section>
      )}

      {/* Section 01 */}
      <section>
        <SectionTitle label="01" title={t('dashboard.summary')} caption={t('dashboard.captions.keyMetrics')} />
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={t('dashboard.metrics.total')}
            value={totalVal}
            hint={t('dashboard.metrics.allTime')}
            data={spark.length ? spark : sparkFallback}
            accent="blue"
          />
          <StatCard
            label={user.role === 'USER' ? t('dashboard.metrics.active') : t('dashboard.metrics.open')}
            value={activeVal}
            hint={t('dashboard.metrics.needReaction')}
            data={spark.length ? spark : sparkFallback}
            accent="amber"
          />
          <StatCard
            label={t('dashboard.metrics.resolved')}
            value={resolvedVal}
            hint={t('dashboard.metrics.allTime')}
            data={spark.length ? spark : sparkFallback}
            accent="green"
          />
          <StatCard
            label={user.role === 'ADMIN' ? t('dashboard.metrics.slaBreached') : t('dashboard.metrics.closed')}
            value={slaVal}
            hint={user.role === 'ADMIN' ? t('dashboard.metrics.allTime') : t('dashboard.metrics.archive')}
            data={spark.length ? spark : sparkFallback}
            accent="red"
          />
        </div>
      </section>

      {/* Section 02 */}
      {user.role !== 'USER' && (
        <section>
          <SectionTitle label="02" title={t('dashboard.flow')} caption={t('dashboard.captions.activity')} />
          <div className="mt-6 grid grid-cols-12 gap-4">
            <article className="col-span-12 lg:col-span-8 rounded-md border border-border bg-card px-6 py-5">
              <header className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    {t('dashboard.tickets14')}
                  </div>
                  <h3 className="mt-2 font-serif text-[22px] leading-tight tracking-[-0.01em]">
                    {t('dashboard.created')} <span className="italic text-muted-foreground">{t('dashboard.byDay')}</span>
                  </h3>
                </div>
              </header>
              <div className="mt-4 h-[260px]">
                <TicketsLineChart data={byDay} />
              </div>
            </article>

            <article className="col-span-12 lg:col-span-4 rounded-md border border-border bg-card px-6 py-5">
              <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {t('dashboard.ticketCategories')}
              </div>
              <h3 className="mt-2 font-serif text-[22px] leading-tight tracking-[-0.01em]">
                {t('dashboard.whatBreaks')}
              </h3>
              <div className="mt-4 h-[180px]">
                <CategoryDonut data={byCat} />
              </div>
              <ul className="mt-4 space-y-2">
                {categoryBreakdown.map((c) => (
                  <li
                    key={c.name}
                    className="flex items-baseline justify-between text-[12px]"
                  >
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <span
                        className="h-2 w-2 rounded-sm"
                        style={{ backgroundColor: c.fill }}
                      />
                      {c.name}
                    </span>
                    <span className="font-medium tabular-nums">{c.value}%</span>
                  </li>
                ))}
                {categoryBreakdown.length === 0 && (
                  <li className="text-[12px] text-muted-foreground italic">{t('dashboard.noData')}</li>
                )}
              </ul>
            </article>
          </div>
        </section>
      )}

      {/* Section 03 */}
      <section>
        <SectionTitle
          label={user.role === 'USER' ? '02' : '03'}
          title={recentTitle}
          caption={t('dashboard.captions.recent')}
          action={
            <Link
              to="/tickets"
              className="inline-flex items-center gap-1 text-[12px] text-foreground hover:text-primary underline underline-offset-4 decoration-foreground/30 hover:decoration-primary"
            >
              {t('dashboard.recent.all')}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          }
        />

        <div className="mt-6 grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8 rounded-md border border-border bg-card overflow-hidden">
            {tickets.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">
                {t('dashboard.recent.empty')}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {tickets.map((ticket, idx) => (
                  <li key={ticket.id}>
                    <Link
                      to={`/tickets/${ticket.id}`}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-accent/50 transition-colors"
                    >
                      <div className="font-mono text-[11px] text-muted-foreground shrink-0 tabular-nums w-10">
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                            #{ticket.ticketNumber}
                          </span>
                          <StatusBadge status={ticket.status} />
                          <div className="hidden md:block">
                            <PriorityBadge priority={ticket.priority} />
                          </div>
                        </div>
                        <div className="mt-1.5 truncate text-[14px] font-medium text-foreground">
                          {ticket.subject}
                        </div>
                        <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                          {ticket.creator.name} · {t(getCategoryLabelKey(ticket.category))}
                        </div>
                      </div>
                      <div className="hidden lg:flex items-center gap-2 shrink-0">
                        {ticket.assignee ? (
                          <>
                            <UserAvatar user={ticket.assignee} size={22} />
                            <span className="text-[12px] text-muted-foreground truncate max-w-[120px]">
                              {ticket.assignee.name.split(' ')[0]}
                            </span>
                          </>
                        ) : (
                          <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                            {t('common.notAssigned')}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground shrink-0 tabular-nums w-24 text-right font-mono">
                        {formatRelative(ticket.updatedAt, i18n.language, t)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Side column */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            {user.role !== 'USER' && agents.length > 0 ? (
              <article className="rounded-md border border-border bg-card">
                <header className="px-5 pt-5 pb-3">
                  <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    {t('dashboard.topAgents')}
                  </div>
                  <h3 className="mt-2 font-serif text-[20px] leading-tight">
                    {t('dashboard.byResolved')}
                  </h3>
                </header>
                <ul className="divide-y divide-border">
                  {agents.slice(0, 5).map((row, idx) => (
                    <li
                      key={row.id}
                      className="flex items-center gap-3 px-5 py-3.5"
                    >
                      <span className="w-5 font-mono text-[11px] text-muted-foreground tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <UserAvatar user={{ id: row.id, name: row.name, avatarUrl: row.avatarUrl }} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">
                          {row.name}
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {t(getRoleLabelKey('AGENT'))} · {toNum(row.avgResolutionHours) != null ? `${toNum(row.avgResolutionHours)!.toFixed(1)} ${t('dashboard.sla.hoursShort')}` : '—'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-serif text-[18px] leading-none tabular-nums">
                          {row.resolved}
                        </div>
                        <div className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground mt-1">
                          <Star className="h-2.5 w-2.5 fill-warning text-warning" />
                          {toNum(row.avgRating) != null ? toNum(row.avgRating)!.toFixed(1) : '—'}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ) : user.role === 'USER' ? (
              <article className="rounded-md border border-border bg-card px-5 py-5">
                <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  {t('dashboard.quickActions')}
                </div>
                <h3 className="mt-2 font-serif text-[20px] leading-tight">
                  {t('dashboard.whatCanDo')}
                </h3>
                <ul className="mt-4 space-y-0.5">
                  <QuickAction icon={TicketIcon} label={t('dashboard.reportProblem')} to="/tickets/create" />
                  <QuickAction icon={BookOpen} label={t('dashboard.openKb')} to="/kb" />
                  <QuickAction icon={CheckCircle2} label={t('dashboard.myTickets')} to="/tickets" />
                </ul>
              </article>
            ) : null}

            {/* KB — editorial "from the archive" column */}
            {kb.length > 0 && (
              <article className="rounded-md border border-border bg-card px-5 py-5">
                <div className="flex items-baseline justify-between">
                  <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    {t('dashboard.fromKb')}
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground/70">
                    top · {kb.length}
                  </span>
                </div>
                <h3 className="mt-2 font-serif text-[20px] leading-tight">
                  {t('dashboard.mostRead')}
                </h3>
                <ol className="mt-5 space-y-4">
                  {kb.map((a, idx) => (
                    <li key={a.id} className="flex gap-3">
                      <span className="font-mono text-[11px] text-muted-foreground/80 tabular-nums pt-0.5">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <Link to={`/kb/${a.id}`} className="group block flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            {a.category
                              ? t(getCategoryLabelKey(a.category), { defaultValue: a.category })
                              : t('dashboard.articleFallback')}
                          </span>
                          {a.viewCount != null && (
                            <span className="font-mono text-[10px] text-muted-foreground/70 tabular-nums">
                              {formatCount(a.viewCount, i18n.language)}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[14px] leading-snug font-medium text-foreground group-hover:text-primary transition-colors text-pretty">
                          {a.title}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ol>
              </article>
            )}
          </div>
        </div>
      </section>

      {/* Section 04: SLA ledger (admin/agent only) */}
      {user.role === 'ADMIN' && stats && (
        <section>
          <SectionTitle label="04" title={t('dashboard.sla.title')} caption={t('dashboard.captions.performance')} />
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <SlaCard
              icon={CheckCircle2}
              title={t('dashboard.sla.resolvedTotal')}
              value={String(stats.resolved ?? 0)}
              caption={t('dashboard.sla.allTime')}
              accent="green"
            />
            <SlaCard
              icon={Clock3}
              title={t('dashboard.sla.avgResolution')}
              value={toNum(stats.avgResolutionHours) != null ? `${toNum(stats.avgResolutionHours)!.toFixed(1)} ${t('dashboard.sla.hoursShort')}` : '—'}
              caption={t('dashboard.sla.closedTickets')}
              accent="blue"
            />
            <SlaCard
              icon={AlertCircle}
              title={t('dashboard.sla.breaches')}
              value={String(stats.slaBreached ?? 0)}
              caption={t('dashboard.sla.breachesCaption')}
              accent="amber"
            />
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------- local bits ---------- */

function SectionTitle({
  label,
  title,
  caption,
  action,
}: {
  label: string;
  title: string;
  caption?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-border pb-3">
      <div className="flex items-baseline gap-4 min-w-0">
        <span className="font-mono text-[11px] text-muted-foreground/80 tabular-nums">
          § {label}
        </span>
        <h2 className="font-serif text-[22px] md:text-[26px] leading-none tracking-[-0.01em] truncate">
          {title}
        </h2>
        {caption ? (
          <span className="hidden md:inline font-serif italic text-[14px] text-muted-foreground">
            {caption}
          </span>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  to,
}: {
  icon: React.ElementType;
  label: string;
  to: string;
}) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center gap-3 py-2.5 border-b border-dashed border-border last:border-b-0 hover:text-primary transition-colors"
      >
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
        <span className="text-[13.5px] flex-1">{label}</span>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
      </Link>
    </li>
  );
}

function SlaCard({
  icon: Icon,
  title,
  value,
  caption,
  accent,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  caption: string;
  accent: 'green' | 'blue' | 'amber';
}) {
  const textMap = {
    green: 'text-success',
    blue: 'text-info',
    amber: 'text-warning',
  } as const;
  return (
    <article className="rounded-md border border-border bg-card px-5 py-5">
      <div className="flex items-start justify-between">
        <div
          className={cn(
            'text-[10px] font-medium uppercase tracking-[0.2em]',
            textMap[accent],
          )}
        >
          {title}
        </div>
        <Icon className={cn('h-4 w-4', textMap[accent])} strokeWidth={1.75} />
      </div>
      <div className="mt-5 font-serif text-[40px] leading-none tracking-[-0.02em] tabular-nums">
        {value}
      </div>
      <div className="mt-2 text-[12px] text-muted-foreground">{caption}</div>
    </article>
  );
}
