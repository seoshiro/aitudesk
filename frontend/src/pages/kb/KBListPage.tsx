import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  Eye,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { api } from '../../api/axios';
import type { KnowledgeArticle, TicketCategory } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { PageHeader } from '../../components/page-header';
import { EmptyState } from '../../components/empty-state';
import { Button } from '../../components/ui/button';
import { categoryLabels } from '../../lib/mappers';
import { cn } from '../../lib/utils';

const CATEGORIES: TicketCategory[] = ['HARDWARE', 'SOFTWARE', 'NETWORK', 'OTHER'];

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/!\[.*?\]\(.+?\)/g, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/---/g, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export default function KBListPage() {
  const user = useAuthStore((s) => s.user)!;
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<TicketCategory | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ limit: '50' });
    if (query) params.set('search', query);
    if (category) params.set('category', category);
    void api
      .get<{ articles: KnowledgeArticle[]; total: number }>(`/kb/articles?${params}`)
      .then((r) => {
        setArticles(r.data.articles);
        setTotal(r.data.total);
      })
      .catch(() => {});
  }, [query, category]);

  const categoryCounts = useMemo(() => {
    const map = new Map<TicketCategory, number>();
    for (const a of articles) map.set(a.category, (map.get(a.category) ?? 0) + 1);
    return CATEGORIES.map((c) => ({ name: c, count: map.get(c) ?? 0 }));
  }, [articles]);

  const featured = useMemo(() => articles.slice(0, 3), [articles]);

  return (
    <div className="flex flex-col gap-8 max-w-[1480px] mx-auto">
      <PageHeader
        title="База знаний"
        description="Статьи, инструкции и регламенты IT-поддержки колледжа AITU."
      >
        {user.role === 'ADMIN' && (
          <Button asChild>
            <Link to="/kb/create">
              <Plus className="h-4 w-4 mr-1.5" />
              Новая статья
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* Hero search */}
      <section className="relative overflow-hidden rounded-md border border-border bg-card p-8 md:p-10">
        <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background:radial-gradient(600px_circle_at_50%_-20%,oklch(var(--primary)/0.25),transparent_60%)]" />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>{total} статей</span>
          </div>
          <h2 className="font-serif text-balance text-3xl tracking-[-0.01em] md:text-4xl leading-tight">
            Чем мы можем помочь?
          </h2>
          <p className="text-pretty text-sm text-muted-foreground md:text-base">
            Найдите ответ в базе знаний — от подключения Wi-Fi до настройки VPN и сброса пароля.
          </p>
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Например: «принтер HP», «VPN на Mac» или «сброс пароля»"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-12 w-full rounded-md border border-border bg-background pl-11 pr-3 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>Популярное:</span>
            {['Wi-Fi', 'Принтер', 'VPN', 'Сеть'].map((t) => (
              <button
                key={t}
                onClick={() => setQuery(t)}
                className="rounded-full border border-border bg-muted/40 px-3 py-1 transition hover:border-primary/40 hover:text-foreground"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl tracking-[-0.01em]">Разделы</h3>
          {category && (
            <button
              onClick={() => setCategory(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Показать все
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {categoryCounts.map((cat) => {
            const active = category === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => setCategory(active ? null : cat.name)}
                className={cn(
                  'group flex flex-col items-start gap-3 rounded-md border p-4 text-left transition',
                  active
                    ? 'border-primary/60 bg-primary/5'
                    : 'border-border bg-card hover:border-primary/40',
                )}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-md border',
                    active
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-muted/50 text-muted-foreground group-hover:text-foreground',
                  )}
                >
                  <BookOpen className="h-4 w-4" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{categoryLabels[cat.name]}</span>
                  <span className="text-xs text-muted-foreground">{cat.count} статей</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Featured */}
      {!query && !category && featured.length > 0 && (
        <section className="flex flex-col gap-4">
          <h3 className="font-serif text-xl tracking-[-0.01em]">Читают чаще всего</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {featured.map((a) => (
              <Link
                key={a.id}
                to={`/kb/${a.id}`}
                className="group relative h-full overflow-hidden rounded-md border border-border bg-card p-6 transition hover:border-primary/40"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                    {categoryLabels[a.category]}
                  </span>
                  <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>
                <h4 className="mt-4 font-serif text-[18px] leading-snug text-balance tracking-[-0.01em]">
                  {a.title}
                </h4>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                  {stripMarkdown(a.content).slice(0, 180)}…
                </p>
                <div className="mt-5 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    {a.viewCount.toLocaleString('ru-RU')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* All articles */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl tracking-[-0.01em]">
            {category ? categoryLabels[category] : query ? `Результаты: ${articles.length}` : 'Все статьи'}
          </h3>
          <span className="text-xs text-muted-foreground">
            Всего {articles.length} из {total}
          </span>
        </div>

        {articles.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Ничего не найдено"
            description="Попробуйте изменить формулировку или выбрать другой раздел."
            action={{
              label: 'Сбросить фильтры',
              onClick: () => {
                setQuery('');
                setCategory(null);
              },
            }}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <Link
                key={a.id}
                to={`/kb/${a.id}`}
                className="group flex h-full flex-col gap-4 rounded-md border border-border bg-card p-5 transition hover:border-primary/40"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {categoryLabels[a.category]}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>
                <h4 className="font-serif text-[16px] leading-snug text-balance tracking-[-0.01em]">
                  {a.title}
                </h4>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {stripMarkdown(a.content).slice(0, 150)}…
                </p>
                <div className="mt-auto flex items-center gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
                  <span className="ml-auto flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    {a.viewCount.toLocaleString('ru-RU')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

