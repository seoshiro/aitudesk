import { Router, Response } from 'express';
import { z } from 'zod';
import OpenAI from 'openai';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const aiRouter = Router();
aiRouter.use(authenticate);

// ── AI provider (OpenAI-compatible) ────────────────────────────────────────
// Поддерживаются любые OpenAI-совместимые провайдеры: Google Gemini, Groq,
// OpenRouter, Cerebras, NVIDIA Integrate, OpenAI и т.д. — нужно только
// прописать соответствующие AI_BASE_URL / AI_MODEL в .env.
//
// Старые имена NVIDIA_* читаются как fallback для обратной совместимости.
const AI_BASE_URL =
  process.env['AI_BASE_URL'] ??
  process.env['NVIDIA_BASE_URL'] ??
  'https://api.groq.com/openai/v1';
const AI_API_KEY = process.env['AI_API_KEY'] ?? process.env['NVIDIA_API_KEY'] ?? '';
const AI_MODEL =
  process.env['AI_MODEL'] ?? process.env['NVIDIA_MODEL'] ?? 'llama-3.3-70b-versatile';

const openai = new OpenAI({
  apiKey: AI_API_KEY,
  baseURL: AI_BASE_URL,
});

// ── Schemas ───────────────────────────────────────────────────────────────
const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(ChatMessageSchema).max(20).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────
const STOPWORDS = new Set([
  'как', 'что', 'это', 'для', 'или', 'при', 'где', 'когда', 'почему',
  'кто', 'чем', 'мне', 'меня', 'моя', 'мой', 'моё', 'мои', 'есть',
  'нет', 'был', 'была', 'было', 'быть', 'буду', 'будет',
  'the', 'and', 'for', 'how', 'what', 'why', 'who', 'when', 'where',
  'are', 'was', 'were', 'this', 'that', 'with', 'from',
]);

function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
    ),
  ).slice(0, 8);
}

interface KbHit {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
}

async function retrieveContext(query: string, limit = 3): Promise<KbHit[]> {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];

  const orConditions = keywords.flatMap((kw) => [
    { title: { contains: kw, mode: 'insensitive' as const } },
    { content: { contains: kw, mode: 'insensitive' as const } },
    { tags: { has: kw } },
  ]);

  const articles = await prisma.knowledgeArticle.findMany({
    where: { published: true, OR: orConditions },
    orderBy: { viewCount: 'desc' },
    take: limit * 3,
  });

  // Re-rank by simple keyword frequency score
  const scored = articles.map((a) => {
    const haystack = `${a.title}\n${a.content}\n${a.tags.join(' ')}`.toLowerCase();
    const score = keywords.reduce(
      (s, kw) => s + (haystack.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))?.length ?? 0),
      0,
    );
    return { article: a, score };
  });

  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => ({
      id: x.article.id,
      title: x.article.title,
      content: x.article.content,
      category: x.article.category,
      tags: x.article.tags,
    }));
}

function buildSystemPrompt(context: KbHit[]): string {
  const base =
    'Ты — дружелюбный технический ассистент AituDesk. ' +
    'Ты умеешь вести обычный разговор: здороваться, отвечать на общие вопросы, шутить. ' +
    'Когда пользователь задаёт технический вопрос или вопрос по IT-поддержке, ' +
    'опирайся на предоставленный контекст из базы знаний. ' +
    'Если в контексте нет нужной информации — честно скажи об этом ' +
    'и предложи создать заявку через кнопку «Создать заявку». ' +
    'Отвечай кратко, по делу, на том же языке, на котором пишет пользователь.';

  if (context.length === 0) {
    return base;
  }

  const blocks = context
    .map(
      (a, i) =>
        `### Источник ${i + 1}: ${a.title} (категория: ${a.category})\n${a.content.slice(0, 1500)}`,
    )
    .join('\n\n---\n\n');

  return `${base}\n\n[КОНТЕКСТ ИЗ БАЗЫ ЗНАНИЙ]\n${blocks}`;
}

// ── Routes ────────────────────────────────────────────────────────────────

// POST /api/ai/chat
aiRouter.post('/chat', validate(ChatRequestSchema), async (req: AuthRequest, res: Response) => {
  if (!AI_API_KEY) {
    res.status(503).json({ error: 'AI assistant is not configured (AI_API_KEY missing)' });
    return;
  }

  const { message, history = [] } = ChatRequestSchema.parse(req.body);

  try {
    const context = await retrieveContext(message);
    const systemPrompt = buildSystemPrompt(context);

    const params = {
      model: AI_MODEL,
      temperature: 0.3,
      top_p: 0.9,
      max_tokens: 700,
      messages: [
        { role: 'system' as const, content: systemPrompt },
        ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: message },
      ],
    };

    // Retry with exponential backoff for 429 / 5xx
    const MAX_RETRIES = 3;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const completion = await openai.chat.completions.create(params);
        const reply = completion.choices[0]?.message?.content?.trim() ?? '';
        res.json({
          reply,
          sources: context.map((c) => ({ id: c.id, title: c.title, category: c.category })),
        });
        return;
      } catch (e: unknown) {
        lastErr = e;
        const status = (e as { status?: number }).status;
        const retryable = status === 429 || (status !== undefined && status >= 500);
        if (!retryable || attempt === MAX_RETRIES) break;
        const delay = Math.min(1000 * 2 ** attempt, 8000);
        console.warn(`[AI] attempt ${attempt + 1} failed (${status}), retrying in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw lastErr;
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'AI request failed';
    const status = (err as { status?: number }).status;
    console.error('[AI] chat error:', detail);
    if (status === 429) {
      res.status(429).json({ error: 'AI provider rate limited — попробуйте через минуту', detail });
    } else {
      res.status(502).json({ error: 'AI provider error', detail });
    }
  }
});
