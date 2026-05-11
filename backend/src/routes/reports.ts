import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { runPdfReport } from '../services/reportRunner';

export const reportsRouter = Router();
reportsRouter.use(authenticate);

const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
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

  // Closed tickets in the period
  const closedCount = await prisma.ticket.count({
    where: {
      status: { in: ['RESOLVED', 'CLOSED'] },
      resolvedAt: { gte: startDate, lt: endDate },
    },
  });

  // Average resolution time (hours)
  const avgResRaw = await prisma.$queryRaw<{ avg_hours: number | null }[]>`
    SELECT EXTRACT(EPOCH FROM AVG("resolvedAt" - "createdAt")) / 3600 AS avg_hours
    FROM tickets
    WHERE "resolvedAt" IS NOT NULL
      AND "resolvedAt" >= ${startDate}
      AND "resolvedAt" < ${endDate}
  `;
  const avgHours = avgResRaw[0]?.avg_hours ?? 0;

  // Average satisfaction rating
  const avgRatingRaw = await prisma.rating.aggregate({
    where: {
      createdAt: { gte: startDate, lt: endDate },
    },
    _avg: { score: true },
    _count: { score: true },
  });
  const avgRating = avgRatingRaw._avg.score;
  const ratingCount = avgRatingRaw._count.score;

  // Total tickets created in the period
  const createdCount = await prisma.ticket.count({
    where: { createdAt: { gte: startDate, lt: endDate } },
  });

  // ── Build PDF in a Worker Thread (event-loop friendly) ─────────────────
  const monthName = MONTH_NAMES[month - 1] ?? '';
  const pdfBuffer = await runPdfReport({
    monthParam,
    monthName,
    year,
    createdCount,
    closedCount,
    avgHours: avgHours ? Number(avgHours) : null,
    avgRating: avgRating ?? null,
    ratingCount: ratingCount ?? 0,
  });

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename=report-${monthParam}.pdf`,
    'Content-Length': String(pdfBuffer.length),
  });
  res.end(pdfBuffer);
});
