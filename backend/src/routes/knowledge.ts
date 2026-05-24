import { Router, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const knowledgeRouter = Router();
knowledgeRouter.use(authenticate);

const LOCALES = ['ru', 'en', 'kk'] as const;
type KbLocale = (typeof LOCALES)[number];

const TranslationSchema = z.object({
  title: z.string().min(5).max(255),
  content: z.string().min(20),
  slug: z.string().min(1).max(255).optional(),
});

const TranslationsSchema = z.object({
  ru: TranslationSchema.optional(),
  en: TranslationSchema.optional(),
  kk: TranslationSchema.optional(),
});

const ArticleSchema = z
  .object({
    title: z.string().min(5).max(255).optional(),
    content: z.string().min(20).optional(),
    category: z.enum(['HARDWARE', 'SOFTWARE', 'NETWORK', 'OTHER']),
    tags: z.array(z.string()).optional(),
    published: z.boolean().optional(),
    translations: TranslationsSchema.optional(),
  })
  .refine(
    (data) => Boolean(data.title && data.content) || Boolean(data.translations && Object.keys(data.translations).length > 0),
    { message: 'At least one translation is required' },
  );

const ArticleUpdateSchema = z.object({
  title: z.string().min(5).max(255).optional(),
  content: z.string().min(20).optional(),
  category: z.enum(['HARDWARE', 'SOFTWARE', 'NETWORK', 'OTHER']).optional(),
  tags: z.array(z.string()).optional(),
  published: z.boolean().optional(),
  translations: TranslationsSchema.optional(),
});

const articleInclude = { translations: true } as const;

type ArticleWithTranslations = NonNullable<
  Prisma.KnowledgeArticleGetPayload<{ include: typeof articleInclude }>
>;
type TranslationInput = { title: string; content: string; slug?: string };

function parseLocale(req: AuthRequest): KbLocale {
  const queryLang = typeof req.query['lang'] === 'string' ? req.query['lang'] : undefined;
  const headerLang = req.headers['accept-language']?.split(',')[0]?.trim();
  const candidate = (queryLang ?? headerLang ?? 'ru').split('-')[0] as KbLocale;
  return LOCALES.includes(candidate) ? candidate : 'ru';
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function normalizeTranslations(data: {
  title?: string;
  content?: string;
  translations?: z.infer<typeof TranslationsSchema>;
}): Record<KbLocale, TranslationInput | undefined> {
  const pick = (value: z.infer<typeof TranslationSchema> | undefined): TranslationInput | undefined =>
    value?.title && value.content ? { title: value.title, content: value.content, slug: value.slug } : undefined;

  const translations: Record<KbLocale, TranslationInput | undefined> = {
    ru: pick(data.translations?.ru),
    en: pick(data.translations?.en),
    kk: pick(data.translations?.kk),
  };

  if (data.title && data.content) {
    translations.ru = { title: data.title, content: data.content, slug: translations.ru?.slug };
  }

  return translations;
}

function selectTranslation(article: ArticleWithTranslations, locale: KbLocale) {
  const translations = article.translations ?? [];
  return (
    translations.find((translation) => translation.locale === locale) ??
    translations.find((translation) => translation.locale === 'ru') ??
    translations[0] ??
    { locale: 'ru', title: article.title, content: article.content, slug: undefined }
  );
}

function serializeArticle(article: ArticleWithTranslations, locale: KbLocale, includeTranslations = false) {
  const selected = selectTranslation(article, locale);
  const base = {
    ...article,
    title: selected.title,
    content: selected.content,
    locale: selected.locale,
  };

  if (!includeTranslations) {
    const { translations: _translations, ...localized } = base;
    return localized;
  }

  return {
    ...base,
    translations: LOCALES.reduce(
      (acc, lng) => {
        const translation = (article.translations ?? []).find((item) => item.locale === lng);
        acc[lng] = translation
          ? { title: translation.title, content: translation.content, slug: translation.slug ?? undefined }
          : undefined;
        return acc;
      },
      {} as Record<KbLocale, { title: string; content: string; slug?: string } | undefined>,
    ),
  };
}

function buildTranslationUpserts(
  articleId: string,
  translations: Record<KbLocale, { title: string; content: string; slug?: string } | undefined>,
) {
  return LOCALES.flatMap((locale) => {
    const translation = translations[locale];
    if (!translation) return [];
    const slug = translation.slug ?? toSlug(translation.title);
    return {
      where: { articleId_locale: { articleId, locale } },
      create: { locale, title: translation.title, content: translation.content, slug },
      update: { title: translation.title, content: translation.content, slug },
    };
  });
}

// GET /api/kb/articles
knowledgeRouter.get('/articles', async (req: AuthRequest, res: Response) => {
  const { search, category, page = '1', limit = '20' } = req.query as Record<string, string>;
  const locale = parseLocale(req);
  const where: Record<string, unknown> = { published: true };

  if (category) where['category'] = category;
  if (search) {
    const translationSearch = (lng: KbLocale) => ({
      translations: {
        some: {
          locale: lng,
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { content: { contains: search, mode: 'insensitive' as const } },
          ],
        },
      },
    });

    where['OR'] = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
      { tags: { has: search } },
      translationSearch(locale),
      ...(locale === 'ru' ? [] : [translationSearch('ru')]),
    ];
  }

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const [articles, total] = await Promise.all([
    prisma.knowledgeArticle.findMany({
      where,
      include: articleInclude,
      orderBy: { viewCount: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.knowledgeArticle.count({ where }),
  ]);

  res.json({
    articles: articles.map((article) => serializeArticle(article, locale)),
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
  });
});

// GET /api/kb/articles/:id
knowledgeRouter.get('/articles/:id', async (req: AuthRequest, res: Response) => {
  const locale = parseLocale(req);
  const includeTranslations = req.query['includeTranslations'] === 'true' && req.user?.role === 'ADMIN';
  const article = await prisma.knowledgeArticle.findUnique({
    where: { id: req.params['id'] },
    include: articleInclude,
  });
  if (!article) { res.status(404).json({ error: 'Article not found' }); return; }
  await prisma.knowledgeArticle.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } });
  res.json(serializeArticle(article, locale, includeTranslations));
});

// POST /api/kb/articles (admin only)
knowledgeRouter.post('/articles', requireRole('ADMIN'), validate(ArticleSchema), async (req: AuthRequest, res: Response) => {
  const data = ArticleSchema.parse(req.body);
  const translations = normalizeTranslations(data);
  const fallback = translations.ru ?? translations.en ?? translations.kk;
  if (!fallback) { res.status(400).json({ error: 'At least one translation is required' }); return; }

  const article = await prisma.knowledgeArticle.create({
    data: {
      title: fallback.title,
      content: fallback.content,
      category: data.category,
      tags: data.tags ?? [],
      published: data.published ?? true,
      authorId: req.user!.id,
      translations: {
        create: LOCALES.flatMap((locale) => {
          const translation = translations[locale];
          if (!translation) return [];
          return {
            locale,
            title: translation.title,
            content: translation.content,
            slug: translation.slug ?? toSlug(translation.title),
          };
        }),
      },
    },
    include: articleInclude,
  });
  res.status(201).json(serializeArticle(article, parseLocale(req), true));
});

// PUT /api/kb/articles/:id (admin)
knowledgeRouter.put('/articles/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const data = ArticleUpdateSchema.parse(req.body);
  const translations = normalizeTranslations(data);
  const fallback = translations.ru ?? translations.en ?? translations.kk;

  const article = await prisma.knowledgeArticle.update({
    where: { id: req.params['id'] },
    data: {
      ...(data.category ? { category: data.category } : {}),
      ...(data.tags ? { tags: data.tags } : {}),
      ...(data.published !== undefined ? { published: data.published } : {}),
      ...(data.title ? { title: data.title } : {}),
      ...(data.content ? { content: data.content } : {}),
      ...(fallback ? { title: fallback.title, content: fallback.content } : {}),
      ...(fallback
        ? { translations: { upsert: buildTranslationUpserts(req.params['id'], translations) } }
        : {}),
    },
    include: articleInclude,
  });
  res.json(serializeArticle(article, parseLocale(req), true));
});

// DELETE /api/kb/articles/:id (admin)
knowledgeRouter.delete('/articles/:id', requireRole('ADMIN'), async (req, res: Response) => {
  await prisma.knowledgeArticle.delete({ where: { id: req.params['id'] } });
  res.json({ message: 'Deleted' });
});
