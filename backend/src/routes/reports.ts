import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { runPdfReport } from '../services/reportRunner';

export const reportsRouter = Router();
reportsRouter.use(authenticate);

const MONTH_NAMES_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

// GET /api/reports/monthly?month=2024-01
reportsRouter.get('/monthly', async (req: AuthRequest, res: Response) => {
  const monthParam = req.query['month'] as string | undefined;
  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
    res.status(400).json({ error: 'month query parameter required in YYYY-MM format' });
    return;
  }

  const [yearStr, monthStr] = monthParam.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (month < 1 || month > 12) {
    res.status(400).json({ error: 'Invalid month' });
    return;
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  // ── Queries (parallel where possible) ────────────────────────────────────
  const [
    createdCount,
    closedCount,
    openCount,
    slaBreachedCount,
    avgResRaw,
    avgRatingRaw,
    byCategoryRaw,
    byPriorityRaw,
  ] = await Promise.all([
    // Created in period
    prisma.ticket.count({ where: { createdAt: { gte: startDate, lt: endDate } } }),
    // Closed/Resolved in period
    prisma.ticket.count({
      where: {
        status: { in: ['RESOLVED', 'CLOSED'] },
        resolvedAt: { gte: startDate, lt: endDate },
      },
    }),
    // Still open (not resolved/closed) created in period
    prisma.ticket.count({
      where: {
        createdAt: { gte: startDate, lt: endDate },
        status: { notIn: ['RESOLVED', 'CLOSED'] },
      },
    }),
    // SLA breached in period
    prisma.ticket.count({
      where: {
        createdAt: { gte: startDate, lt: endDate },
        slaBreached: true,
      },
    }),
    // Avg resolution time
    prisma.$queryRaw<{ avg_hours: number | null }[]>`
      SELECT EXTRACT(EPOCH FROM AVG("resolvedAt" - "createdAt")) / 3600 AS avg_hours
      FROM tickets
      WHERE "resolvedAt" IS NOT NULL
        AND "resolvedAt" >= ${startDate}
        AND "resolvedAt" < ${endDate}
    `,
    // Avg rating
    prisma.rating.aggregate({
      where: { createdAt: { gte: startDate, lt: endDate } },
      _avg: { score: true },
      _count: { score: true },
    }),
    // By category
    prisma.ticket.groupBy({
      by: ['category'],
      where: { createdAt: { gte: startDate, lt: endDate } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
    // By priority
    prisma.ticket.groupBy({
      by: ['priority'],
      where: { createdAt: { gte: startDate, lt: endDate } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
  ]);

  const avgHours = avgResRaw[0]?.avg_hours ?? null;
  const avgRating = avgRatingRaw._avg.score;
  const ratingCount = avgRatingRaw._count.score;

  const byCategory = byCategoryRaw.map(r => ({ category: r.category, count: r._count.id }));
  const byPriority = byPriorityRaw.map(r => ({ priority: r.priority, count: r._count.id }));

  const monthLabel = `${MONTH_NAMES_RU[month - 1]} ${year} г.`;

  // ── Build PDF in a Worker Thread (event-loop friendly) ─────────────────
  const pdfBuffer = await runPdfReport({
    monthParam,
    monthLabel,
    createdCount,
    closedCount,
    openCount,
    avgHours: avgHours ? Number(avgHours) : null,
    avgRating: avgRating ?? null,
    ratingCount: ratingCount ?? 0,
    slaBreachedCount,
    byCategory,
    byPriority,
  });

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename=report-${monthParam}.pdf`,
    'Content-Length': String(pdfBuffer.length),
  });
  res.end(pdfBuffer);
});
