import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/axios';
import type { KnowledgeArticle, TicketCategory } from '../../types';
import { PageHeader } from '../../components/page-header';
import { Button } from '../../components/ui/button';
import { getCategoryLabelKey } from '../../lib/mappers';
import { normalizeLanguage } from '../../lib/locale';

const CATEGORIES: TicketCategory[] = ['HARDWARE', 'SOFTWARE', 'NETWORK', 'OTHER'];
const LOCALES = ['ru', 'en', 'kk'] as const;
type KbLocale = (typeof LOCALES)[number];

const emptyTranslations: Record<KbLocale, { title: string; content: string }> = {
  ru: { title: '', content: '' },
  en: { title: '', content: '' },
  kk: { title: '', content: '' },
};

export default function KBEditorPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [translations, setTranslations] = useState(emptyTranslations);
  const [category, setCategory] = useState<TicketCategory>('SOFTWARE');
  const [tags, setTags] = useState('');
  const [published, setPublished] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      void api
        .get<KnowledgeArticle>(`/kb/articles/${id}`, {
          params: { lang: normalizeLanguage(i18n.language), includeTranslations: true },
        })
        .then((r) => {
          setTranslations({
            ru: {
              title: r.data.translations?.ru?.title ?? r.data.title,
              content: r.data.translations?.ru?.content ?? r.data.content,
            },
            en: {
              title: r.data.translations?.en?.title ?? '',
              content: r.data.translations?.en?.content ?? '',
            },
            kk: {
              title: r.data.translations?.kk?.title ?? '',
              content: r.data.translations?.kk?.content ?? '',
            },
          });
          setCategory(r.data.category);
          setTags(r.data.tags.join(', '));
          setPublished(r.data.published);
        })
        .catch(() => {});
    }
  }, [id, i18n.language, isEdit]);

  const updateTranslation = (locale: KbLocale, field: 'title' | 'content', value: string) => {
    setTranslations((prev) => ({
      ...prev,
      [locale]: { ...prev[locale], [field]: value },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const data = {
      translations,
      category,
      published,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };
    try {
      if (isEdit) {
        await api.put(`/kb/articles/${id}`, data);
        toast.success(t('kb.editor.updated'));
      } else {
        await api.post('/kb/articles', data);
        toast.success(t('kb.editor.created'));
      }
      navigate('/kb');
    } catch {
      toast.error(t('kb.editor.saveError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-5">
        <Link
          to="/kb"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t('common.knowledgeBase')}
        </Link>
      </div>

      <PageHeader
        title={isEdit ? t('kb.editor.editTitle') : t('kb.editor.newTitle')}
        description={t('kb.editor.description')}
      />

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="mt-6 rounded-md border border-border bg-card p-6 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('kb.editor.category')}>
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
          </Field>

          <Field label={t('kb.editor.tags')} hint={t('kb.editor.tagsHint')}>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder={t('kb.editor.tagsPlaceholder')}
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
        </div>

        <div className="space-y-5">
          {LOCALES.map((locale) => (
            <section key={locale} className="rounded-md border border-border bg-background/40 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="font-serif text-lg leading-none">
                  {t(`kb.editor.locales.${locale}`)}
                </h3>
                <span className="rounded border border-border bg-muted/50 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {locale}
                </span>
              </div>

              <div className="space-y-4">
                <Field label={t('kb.editor.title')} required>
                  <input
                    value={translations[locale].title}
                    onChange={(e) => updateTranslation(locale, 'title', e.target.value)}
                    required
                    minLength={5}
                    placeholder={t(`kb.editor.placeholders.${locale}.title`)}
                    className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </Field>

                <Field label={t('kb.editor.content')} required hint={t('kb.editor.contentHint')}>
                  <textarea
                    value={translations[locale].content}
                    onChange={(e) => updateTranslation(locale, 'content', e.target.value)}
                    required
                    minLength={20}
                    rows={locale === 'ru' ? 14 : 10}
                    placeholder={t(`kb.editor.placeholders.${locale}.content`)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring resize-y min-h-[220px] font-mono"
                  />
                </Field>
              </div>
            </section>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="rounded border-border"
          />
          <span>{t('kb.editor.published')}</span>
        </label>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="ghost" onClick={() => navigate('/kb')}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? t('common.saving') : isEdit ? t('common.save') : t('common.publish')}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
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
