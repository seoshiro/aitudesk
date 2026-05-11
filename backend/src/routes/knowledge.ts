import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const knowledgeRouter = Router();
knowledgeRouter.use(authenticate);

const ArticleSchema = z.object({
  title: z.string().min(5).max(255),
  content: z.string().min(20),
  category: z.enum(['HARDWARE', 'SOFTWARE', 'NETWORK', 'OTHER']),
  tags: z.array(z.string()).optional(),
  published: z.boolean().optional(),
});

// GET /api/kb/articles
knowledgeRouter.get('/articles', async (req: AuthRequest, res: Response) => {
  const { search, category, page = '1', limit = '20' } = req.query as Record<string, string>;
  const where: Record<string, unknown> = { published: true };
  if (category) where['category'] = category;
  if (search) where['OR'] = [
    { title: { contains: search, mode: 'insensitive' } },
    { content: { contains: search, mode: 'insensitive' } },
    { tags: { has: search } },
  ];

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const [articles, total] = await Promise.all([
    prisma.knowledgeArticle.findMany({
      where,
      orderBy: { viewCount: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.knowledgeArticle.count({ where }),
  ]);

  res.json({ articles, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
});

// GET /api/kb/articles/:id
knowledgeRouter.get('/articles/:id', async (req, res: Response) => {
  const article = await prisma.knowledgeArticle.findUnique({ where: { id: req.params['id'] } });
  if (!article) { res.status(404).json({ error: 'Article not found' }); return; }
  await prisma.knowledgeArticle.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } });
  res.json(article);
});

// POST /api/kb/articles (admin only)
knowledgeRouter.post('/articles', requireRole('ADMIN'), validate(ArticleSchema), async (req: AuthRequest, res: Response) => {
  const data = ArticleSchema.parse(req.body);
  const article = await prisma.knowledgeArticle.create({
    data: { ...data, tags: data.tags ?? [], authorId: req.user!.id } as any,
  });
  res.status(201).json(article);
});

// PUT /api/kb/articles/:id (admin)
knowledgeRouter.put('/articles/:id', requireRole('ADMIN'), async (req, res: Response) => {
  const data = ArticleSchema.partial().parse(req.body);
  const article = await prisma.knowledgeArticle.update({ where: { id: req.params['id'] }, data: data as any });
  res.json(article);
});

// DELETE /api/kb/articles/:id (admin)
knowledgeRouter.delete('/articles/:id', requireRole('ADMIN'), async (req, res: Response) => {
  await prisma.knowledgeArticle.delete({ where: { id: req.params['id'] } });
  res.json({ message: 'Deleted' });
});