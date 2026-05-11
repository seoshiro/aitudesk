import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/axios';
import type { KnowledgeArticle, TicketCategory } from '../../types';
import { PageHeader } from '../../components/page-header';
import { Button } from '../../components/ui/button';
import { categoryLabels } from '../../lib/mappers';

const CATEGORIES: TicketCategory[] = ['HARDWARE', 'SOFTWARE', 'NETWORK', 'OTHER'];

export default function KBEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<TicketCategory>('SOFTWARE');
  const [tags, setTags] = useState('');
  const [published, setPublished] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      void api
        .get<KnowledgeArticle>(`/kb/articles/${id}`)
        .then((r) => {
          setTitle(r.data.title);
          setContent(r.data.content);
          setCategory(r.data.category);
          setTags(r.data.tags.join(', '));
          setPublished(r.data.published);
        })
        .catch(() => {});
    }
  }, [id, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const data = {
      title,
      content,
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
        toast.success('Статья обновлена');
      } else {
        await api.post('/kb/articles', data);
        toast.success('Статья создана');
      }
      navigate('/kb');
    } catch {
      toast.error('Не удалось сохранить статью');
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
          База знаний
        </Link>
      </div>

      <PageHeader
        title={isEdit ? 'Редактировать статью' : 'Новая статья'}
        description="Короткие, понятные шаги работают лучше всего. Используйте Markdown для форматирования."
      />

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="mt-6 rounded-md border border-border bg-card p-6 space-y-5"
      >
        <Field label="Заголовок" required>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={5}
            placeholder="Например: Как настроить VPN на MacOS"
            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Категория">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabels[c]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Теги" hint="через запятую">
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="vpn, доступ, office"
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>
        </div>

        <Field label="Содержимое" required hint="Markdown поддерживается">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            minLength={20}
            rows={18}
            placeholder="# Заголовок&#10;&#10;Краткое описание...&#10;&#10;## Шаг 1&#10;..."
            className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring resize-y min-h-[300px] font-mono"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="rounded border-border"
          />
          <span>Опубликовать (видно пользователям)</span>
        </label>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="ghost" onClick={() => navigate('/kb')}>
            Отмена
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Сохраняем...' : isEdit ? 'Сохранить' : 'Опубликовать'}
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
