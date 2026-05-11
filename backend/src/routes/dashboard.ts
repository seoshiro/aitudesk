import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

// GET /api/dashboard/stats
dashboardRouter.get('/stats', async (req: AuthRequest, res: Response) => {
  const user = req.user!;

  if (user.role === 'USER') {
    const [total, active, resolved, closed] = await Promise.all([
      prisma.ticket.count({ where: { creatorId: user.id } }),
      prisma.ticket.count({ where: { creatorId: user.id, status: { in: ['NEW', 'IN_PROGRESS', 'WAITING', 'REOPENED'] } } }),
      prisma.ticket.count({ where: { creatorId: user.id, status: 'RESOLVED' } }),
      prisma.ticket.count({ where: { creatorId: user.id, status: 'CLOSED' } }),
    ]);
    res.json({ total, active, resolved, closed });
    return;
  }

  if (user.role === 'AGENT') {
    const [total, active, resolved, slaBreached] = await Promise.all([
      prisma.ticket.count({ where: { assigneeId: user.id } }),
      prisma.ticket.count({ where: { assigneeId: user.id, status: { in: ['IN_PROGRESS', 'WAITING'] } } }),
      prisma.ticket.count({ where: { assigneeId: user.id, status: { in: ['RESOLVED', 'CLOSED'] } } }),
      prisma.ticket.count({ where: { assigneeId: user.id, slaBreached: true } }),
    ]);
    const avgRating = await prisma.rating.aggregate({
      where: { ticket: { assigneeId: user.id } },
      _avg: { score: true },
    });
    res.json({ total, active, resolved, slaBreached, avgRating: avgRating._avg.score });
    return;
  }

  // Admin
  const [total, open, slaBreached, resolved, closed] = await Promise.all([
    prisma.ticket.count(),
    prisma.ticket.count({ where: { status: { in: ['NEW', 'IN_PROGRESS', 'WAITING', 'REOPENED'] } } }),
    prisma.ticket.count({ where: { slaBreached: true } }),
    prisma.ticket.count({ where: { status: 'RESOLVED' } }),
    prisma.ticket.count({ where: { status: 'CLOSED' } }),
  ]);

  const avgResolutionRaw = await prisma.$queryRaw<{ avg_hours: number }[]>`
    SELECT EXTRACT(EPOCH FROM AVG("resolvedAt" - "createdAt")) / 3600 AS avg_hours
    FROM tickets WHERE "resolvedAt" IS NOT NULL
  `;
  const avgRating = await prisma.rating.aggregate({ _avg: { score: true } });

  res.json({ total, open, slaBreached, resolved, closed, avgResolutionHours: avgResolutionRaw[0]?.avg_hours ?? 0, avgRating: avgRating._avg.score });
});

// GET /api/dashboard/tickets-by-day (last 14 days)
dashboardRouter.get('/tickets-by-day', requireRole('ADMIN', 'AGENT'), async (_req, res: Response) => {
  const rows = await prisma.$queryRaw<{ date: string; count: number }[]>`
    SELECT DATE("createdAt") as date, COUNT(*)::int as count
    FROM tickets
    WHERE "createdAt" >= NOW() - INTERVAL '14 days'
    GROUP BY DATE("createdAt")
    ORDER BY date ASC
  `;
  res.json(rows);
});

// GET /api/dashboard/by-category
dashboardRouter.get('/by-category', requireRole('ADMIN', 'AGENT'), async (_req, res: Response) => {
  const rows = await prisma.ticket.groupBy({
    by: ['category'],
    _count: { _all: true },
  });
  res.json(rows.map(r => ({ category: r.category, count: r._count._all })));
});

// GET /api/dashboard/agents
dashboardRouter.get('/agents', requireRole('ADMIN'), async (_req, res: Response) => {
  const agents = await prisma.user.findMany({
    where: { role: 'AGENT' },
    select: {
      id: true, name: true, avatarUrl: true,
      assignedTickets: {
        select: { status: true, resolvedAt: true, createdAt: true, rating: { select: { score: true } } },
      },
    },
  });

  const result = agents.map(a => {
    const total = a.assignedTickets.length;
    const resolved = a.assignedTickets.filter(t => ['RESOLVED', 'CLOSED'].includes(t.status)).length;
    const ratings = a.assignedTickets.flatMap(t => t.rating?.score ? [t.rating.score] : []);
    const avgRating = ratings.length > 0 ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null;
    const resolvedTickets = a.assignedTickets.filter(t => t.resolvedAt && t.createdAt);
    const avgHours = resolvedTickets.length > 0
      ? resolvedTickets.reduce((s, t) => s + (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3600000, 0) / resolvedTickets.length
      : null;
    return { id: a.id, name: a.name, avatarUrl: a.avatarUrl, total, resolved, avgRating, avgResolutionHours: avgHours };
  });

  result.sort((a, b) => b.resolved - a.resolved);
  res.json(result);
});
