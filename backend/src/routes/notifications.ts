import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

// GET /api/notifications
notificationsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const unreadCount = await prisma.notification.count({ where: { userId: req.user!.id, read: false } });
  res.json({ notifications, unreadCount });
});

// PUT /api/notifications/read-all  ← MUST come before /:id to avoid route collision
notificationsRouter.put('/read-all', async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.id, read: false }, data: { read: true } });
  res.json({ message: 'All marked as read' });
});

// PUT /api/notifications/:id/read
notificationsRouter.put('/:id/read', async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({ where: { id: req.params['id'], userId: req.user!.id }, data: { read: true } });
  res.json({ message: 'Marked as read' });
});
