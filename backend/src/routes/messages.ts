import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { canAccessTicket } from '../lib/ticketAccess';
import { emitNotification, emitToTicket } from '../socket';

export const messagesRouter = Router();
messagesRouter.use(authenticate);

// GET /api/tickets/:id/messages
messagesRouter.get('/:id/messages', async (req: AuthRequest, res: Response) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params['id'] },
    select: { id: true, creatorId: true, assigneeId: true, status: true },
  });
  if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }
  if (!canAccessTicket(req.user, ticket)) { res.status(403).json({ error: 'Access denied' }); return; }

  const isUser = req.user!.role === 'USER';
  const messages = await prisma.ticketMessage.findMany({
    where: {
      ticketId: ticket.id,
      ...(isUser ? { type: 'PUBLIC' } : {}),  // Users only see public messages
    },
    select: {
      id: true, content: true, type: true, readBy: true, createdAt: true,
      author: { select: { id: true, name: true, role: true, avatarUrl: true } },
      attachments: { select: { id: true, filename: true, url: true, size: true, mimetype: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json(messages);
});

// POST /api/tickets/:id/messages
messagesRouter.post('/:id/messages', upload.array('attachments', 5), async (req: AuthRequest, res: Response) => {
  const { content, type = 'PUBLIC' } = req.body as { content: string; type?: string };
  const files = (req.files as Express.Multer.File[]) ?? [];

  if (!content?.trim() && files.length === 0) { res.status(400).json({ error: 'Message content or file required' }); return; }
  if (type === 'INTERNAL' && req.user!.role === 'USER') { res.status(403).json({ error: 'Users cannot send internal messages' }); return; }

  const ticket = await prisma.ticket.findUnique({ where: { id: req.params['id'] } });
  if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }
  if (!canAccessTicket(req.user, ticket)) { res.status(403).json({ error: 'Access denied' }); return; }

  const message = await prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      authorId: req.user!.id,
      content: content?.trim() ?? '',
      type: type as 'PUBLIC' | 'INTERNAL',
      attachments: files.length > 0 ? {
        create: files.map(f => ({
          ticketId: ticket.id,
          filename: f.originalname,
          mimetype: f.mimetype,
          size: f.size,
          url: `/uploads/${f.filename}`,
        })),
      } : undefined,
    },
    select: {
      id: true, content: true, type: true, readBy: true, createdAt: true,
      author: { select: { id: true, name: true, role: true, avatarUrl: true } },
      attachments: { select: { id: true, filename: true, url: true, size: true, mimetype: true } },
    },
  });

  // If user replies on WAITING ticket → auto-set IN_PROGRESS
  if (req.user!.role === 'USER' && ticket.status === 'WAITING') {
    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'IN_PROGRESS', waitingSince: null } });
    emitToTicket(ticket.id, 'ticket:status', { ...ticket, status: 'IN_PROGRESS' });
  }

  // Emit message to ticket room
  emitToTicket(ticket.id, 'message:new', message);

  // Notify the other party
  const notifyId = req.user!.role === 'USER' ? ticket.assigneeId : ticket.creatorId;
  if (notifyId) {
    const notif = await prisma.notification.create({
      data: { userId: notifyId, ticketId: ticket.id, type: 'NEW_MESSAGE', title: 'Новое сообщение', message: `Ответ в тикете #${ticket.ticketNumber}` },
    });
    emitNotification(notifyId, notif);
  }

  res.status(201).json(message);
});
