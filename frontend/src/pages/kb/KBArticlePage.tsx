import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Eye, Pencil, Plus } from 'lucide-react';
import { api } from '../../api/axios';
import type { KnowledgeArticle } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/button';
import { getCategoryLabelKey } from '../../lib/mappers';
import { formatCount, formatRelative, normalizeLanguage } from '../../lib/locale';

export default function KBArticlePage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user)!;
  const [article, setArticle] = useState<KnowledgeArticle | null>(null);

  useEffect(() => {
    if (id)
      void api
        .get<KnowledgeArticle>(`/kb/articles/${id}`, { params: { lang: normalizeLanguage(i18n.language) } })
        .then((r) => setArticle(r.data))
        .catch(() => {});
  }, [id, i18n.language]);

  if (!article) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <Link
          to="/kb"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t('common.knowledgeBase')}
        </Link>
        {user.role === 'ADMIN' && (
          <Button asChild variant="outline" size="sm">
            <Link to={`/kb/${article.id}/edit`}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              {t('kb.article.edit')}
            </Link>
          </Button>
        )}
      </div>

      <article className="rounded-md border border-border bg-card p-8 md:p-10">
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.16em]">
          <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-medium text-primary">
            {t(getCategoryLabelKey(article.category))}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Eye className="h-3 w-3" />
            {formatCount(article.viewCount, i18n.language)}
          </span>
          <span className="text-muted-foreground">
            {t('kb.article.updated', { date: formatRelative(article.updatedAt, i18n.language, t) })}
          </span>
        </div>
        <h1 className="mt-4 font-serif text-3xl md:text-4xl tracking-[-0.015em] leading-[1.15] text-balance">
          {article.title}
        </h1>
        <div className="mt-8 text-[15px] leading-[1.75] text-foreground/90 whitespace-pre-wrap font-serif">
          {article.content}
        </div>
        {article.tags.length > 0 && (
          <div className="mt-8 flex gap-1.5 flex-wrap border-t border-border pt-5">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md border border-border bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </article>

      <div className="rounded-md border border-dashed border-border bg-card px-8 py-10 text-center">
        <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          {t('kb.article.notFound')}
        </div>
        <h3 className="mt-3 font-serif text-xl tracking-[-0.01em]">
          {t('kb.article.cta')}
        </h3>
        <Button asChild className="mt-5">
          <Link to="/tickets/create">
            <Plus className="h-4 w-4 mr-1.5" />
            {t('common.createTicket')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
