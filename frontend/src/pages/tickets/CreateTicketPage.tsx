import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
  AlertTriangle,
  BookOpen,
  ChevronLeft,
  Clock3,
  Flame,
  Paperclip,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/axios';
import type { KnowledgeArticle, Priority, Ticket, TicketCategory } from '../../types';
import { PageHeader } from '../../components/page-header';
import { Button } from '../../components/ui/button';
import { getCategoryLabelKey, getPriorityLabelKey } from '../../lib/mappers';
import { normalizeLanguage } from '../../lib/locale';
import { cn } from '../../lib/utils';

const PRIORITY_OPTIONS: {
  value: Priority;
  labelKey: string;
  descriptionKey: string;
  icon: React.ElementType;
  accent: string;
}[] = [
  { value: 'LOW', labelKey: getPriorityLabelKey('LOW'), descriptionKey: 'tickets.create.priorityDescriptions.LOW', icon: Sparkles, accent: 'border-border text-muted-foreground' },
  { value: 'MEDIUM', labelKey: getPriorityLabelKey('MEDIUM'), descriptionKey: 'tickets.create.priorityDescriptions.MEDIUM', icon: Clock3, accent: 'border-primary/40 text-primary' },
  { value: 'HIGH', labelKey: getPriorityLabelKey('HIGH'), descriptionKey: 'tickets.create.priorityDescriptions.HIGH', icon: Zap, accent: 'border-warning/40 text-warning' },
  { value: 'CRITICAL', labelKey: getPriorityLabelKey('CRITICAL'), descriptionKey: 'tickets.create.priorityDescriptions.CRITICAL', icon: Flame, accent: 'border-danger/40 text-danger' },
];

const CATEGORIES: TicketCategory[] = ['HARDWARE', 'SOFTWARE', 'NETWORK', 'OTHER'];

function formatSize(bytes: number, t: TFunction): string {
  if (bytes < 1024) return `${bytes} ${t('tickets.create.bytes')}`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ${t('tickets.create.kilobytes')}`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ${t('tickets.create.megabytes')}`;
}

export default function CreateTicketPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('HARDWARE');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [kbSuggestions, setKbSuggestions] = useState<KnowledgeArticle[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (subject.length < 3) { setKbSuggestions([]); return; }
    debounceRef.current = setTimeout(() => {
      void api
        .get<{ articles: KnowledgeArticle[] }>('/kb/articles', {
          params: { search: subject, limit: 3, lang: normalizeLanguage(i18n.language) },
        })
        .then((r) => setKbSuggestions(r.data.articles ?? []))
        .catch(() => setKbSuggestions([]));
    }, 300);
  }, [subject, i18n.language]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...newFiles].slice(0, 5));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;
    setSubmitting(true);
    const fd = new FormData();
    fd.append('subject', subject);
    fd.append('description', description);
    fd.append('category', category);
    fd.append('priority', priority);
    files.forEach((f) => fd.append('attachments', f));
    try {
      const r = await api.post<Ticket>('/tickets', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(t('tickets.create.success'), { description: `№${r.data.ticketNumber} — ${r.data.subject}` });
      navigate(`/tickets/${r.data.id}`);
    } catch {
      toast.error(t('tickets.create.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-5">
        <Link
          to="/tickets"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />{t('common.backToTickets')}
        </Link>
      </div>

      <PageHeader
        title={t('tickets.create.title')}
        description={t('tickets.create.description')}
      />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-md border border-border bg-card p-6 space-y-5"
        >
          <FormField label={t('tickets.create.subject')} required hint={t('tickets.create.subjectHint')}>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              minLength={5}
              placeholder={t('tickets.create.subjectPlaceholder')}
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </FormField>

          {kbSuggestions.length > 0 && (
            <div className="rounded-md border border-primary/25 bg-primary/5 p-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                {t('tickets.create.kbSuggestion')}
              </p>
              <ul className="mt-2 space-y-1">
                {kbSuggestions.map((a) => (
                  <li key={a.id}>
                    <Link
                      to={`/kb/${a.id}`}
                      className="block text-sm hover:underline underline-offset-4 decoration-primary/40"
                    >
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={t('tickets.list.category')} required>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(getCategoryLabelKey(c))}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label={t('tickets.list.priority')} required>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRIORITY_OPTIONS.map((o) => {
                const active = priority === o.value;
                const Icon = o.icon;
                return (
                  <button
                    type="button"
                    key={o.value}
                    onClick={() => setPriority(o.value)}
                    className={cn(
                      'flex items-start gap-3 rounded-md border p-3 text-left transition-colors',
                      active
                        ? cn(o.accent, 'bg-accent/40')
                        : 'border-border hover:bg-accent/40',
                    )}
                  >
                    <div
                      className={cn(
                        'grid h-8 w-8 shrink-0 place-items-center rounded-md border',
                        active ? o.accent : 'border-border bg-secondary',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">{t(o.labelKey)}</div>
                      <div className="text-[11px] text-muted-foreground leading-snug">
                        {t(o.descriptionKey)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </FormField>

          <FormField
            label={t('tickets.create.descriptionLabel')}
            required
            hint={t('tickets.create.descriptionHint')}
          >
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={10}
              rows={6}
              placeholder={t('tickets.create.descriptionPlaceholder')}
              className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring resize-y min-h-[140px]"
            />
          </FormField>

          <FormField label={t('tickets.create.attachments')} hint={t('tickets.create.attachmentsHint')}>
            <div className="space-y-2">
              {files.length > 0 && (
                <ul className="space-y-1.5">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center gap-2 rounded-md border border-border bg-background pl-2 pr-1 py-1.5"
                    >
                      <div className="grid h-7 w-7 place-items-center rounded bg-primary/10 border border-primary/20">
                        <Paperclip className="h-3 w-3 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium">{f.name}</div>
                        <div className="text-[10px] text-muted-foreground">{formatSize(f.size, t)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                        className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:text-danger hover:bg-accent/50"
                        aria-label={t('common.delete')}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <label className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background py-5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors cursor-pointer">
                <Paperclip className="h-3.5 w-3.5" />
                {t('tickets.create.attachFile')}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFiles}
                  accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.txt,.log"
                />
              </label>
            </div>
          </FormField>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-[11px] text-muted-foreground">
              {t('tickets.create.submitHint')}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" type="button" onClick={() => navigate('/tickets')}>
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={submitting || !subject.trim() || !description.trim()}
              >
                {submitting ? t('tickets.create.submitting') : t('tickets.create.submit')}
              </Button>
            </div>
          </div>
        </form>

        {/* Side */}
        <aside className="space-y-4">
          <div className="rounded-md border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-warning/10 border border-warning/25">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              </div>
              <h3 className="text-sm font-semibold">{t('tickets.create.urgentTitle')}</h3>
            </div>
            <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">
              {t('tickets.create.urgentText')}{' '}
              <span className="text-foreground font-medium">{t('tickets.create.extension')}</span>.
            </p>
          </div>

          <div className="rounded-md border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">{t('tickets.create.slaTitle')}</h3>
            <ul className="mt-3 space-y-2 text-xs">
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">{t(getPriorityLabelKey('CRITICAL'))}</span>
                <span className="font-medium text-danger">1 {t('dashboard.sla.hoursShort')}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">{t(getPriorityLabelKey('HIGH'))}</span>
                <span className="font-medium text-warning">4 {t('dashboard.sla.hoursShort')}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">{t(getPriorityLabelKey('MEDIUM'))}</span>
                <span className="font-medium text-primary">24 {t('dashboard.sla.hoursShort')}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">{t(getPriorityLabelKey('LOW'))}</span>
                <span className="font-medium text-muted-foreground">{t('tickets.create.threeDays')}</span>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs font-medium">
          {label}
          {required ? <span className="ml-0.5 text-danger">*</span> : null}
        </label>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
