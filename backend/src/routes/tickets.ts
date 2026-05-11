import { Router, Response } from 'express';
import { z } from 'zod';
import { Priority, TicketCategory } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { upload } from '../middleware/upload';
import { calculateSlaDeadlines } from '../services/sla.service';
import { autoAssignTicket } from '../services/assignment.service';
import { emitNotification, emitToTicket } from '../socket';
import { ticketsTotal, ticketsResolvedTotal, ticketResolutionDuration } from '../lib/metrics';

export const ticketsRouter = Router();
ticketsRouter.use(authenticate);

const TICKET_SELECT = {
  id: true, ticketNumber: true, subject: true, description: true,
  category: true, priority: true, status: true,
  slaDeadlineResponse: true, slaDeadlineResolve: true, slaBreached: true,
  firstResponseAt: true, resolvedAt: true, waitingSince: true,
  createdAt: true, updatedAt: true,
  creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
  assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
  _count: { select: { messages: true, attachments: true } },
};

const CreateTicketSchema = z.object({
  subject: z.string().min(5).max(255),
  description: z.string().min(10),
  category: z.enum(['HARDWARE', 'SOFTWARE', 'NETWORK', 'OTHER']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
});

// GET /api/tickets
ticketsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const { status, category, priority, assigneeId, search, page = '1', limit = '20', sort = 'createdAt', order = 'desc' } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {};
  if (req.user!.role === 'USER') where['creatorId'] = req.user!.id;
  if (req.user!.role === 'AGENT') {
    where['OR'] = [
      { assigneeId: req.user!.id },
      { assigneeId: null, status: 'NEW' },
    ];
  }
  if (status) where['status'] = status;
  if (category) where['category'] = category;
  if (priority) where['priority'] = priority;
  if (assigneeId) where['assigneeId'] = assigneeId;
  if (search) where['OR'] = [
    { subject: { contains: search, mode: 'insensitive' } },
    { description: { contains: search, mode: 'insensitive' } },
  ];

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      select: TICKET_SELECT,
      orderBy: { [sort]: order },
      skip,
      take: limitNum,
    }),
    prisma.ticket.count({ where }),
  ]);

  res.json({ tickets, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
});

// GET /api/tickets/:id
ticketsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params['id'] },
    select: { ...TICKET_SELECT, attachments: { select: { id: true, filename: true, url: true, size: true, mimetype: true } } },
  });
  if (!ticket) { res.status(404).json({ error: 'Ticket not found' }); return; }
  if (req.user!.role === 'USER' && ticket.creator.id !== req.user!.id) {
    res.status(403).json({ error: 'Access denied' }); return;
  }
  res.json(ticket);
});

// POST /api/tickets
ticketsRouter.post('/', upload.array('attachments', 5), validate(CreateTicketSchema), async (req: AuthRequest, res: Response) => {
  const data = req.body as { subject: string; description: string; category: TicketCategory; priority: Priority };
  const files = (req.files as Express.Multer.File[]) ?? [];

  const { slaDeadlineResponse, slaDeadlineResolve } = calculateSlaDeadlines(data.priority, new Date());
  const assigneeId = await autoAssignTicket(data.category);

  const ticket = await prisma.ticket.create({
    data: {
      subject: data.subject,
      description: data.description,
      category: data.category as any,
      priority: data.priority as any,
      creatorId: req.user!.id,
      assigneeId,
      slaDeadlineResponse,
      slaDeadlineResolve,
      attachments: files.length > 0 ? {
        create: files.map(f => ({
          filename: f.originalname,
          mimetype: f.mimetype,
          size: f.size,
          url: `/uploads/${f.filename}`,
        })),
      } : undefined,
    },
    select: TICKET_SELECT,
  });

  if (assigneeId) {
    const notif = await prisma.notification.create({
      data: { userId: assigneeId, ticketId: ticket.id, type: 'TICKET_ASSIGNED', title: 'Новый тикет назначен', message: `#${ticket.ticketNumber}: ${ticket.subject}` },
    });
    emitNotification(assigneeId, notif);
  }

  ticketsTotal.inc();
  res.status(201).json(ticket);
});

// PUT /api/tickets/:id/status
ticketsRouter.put('/:id/status', async (req: AuthRequest, res: Response) => {
  const { status } = req.body as { status: string };
  const ticket = await prisma.ticket.findUnique({ where: { id: req.params['id'] } });
  if (!ticket) { res.status(404).json({ error: 'Not found' }); return; }

  const user = req.user!;
  if (user.role === 'USER') {
    if (!['CLOSED', 'REOPENED'].includes(status)) { res.status(403).json({ error: 'Users can only close or reopen' }); return; }
    if (status === 'CLOSED' && ticket.status !== 'RESOLVED') { res.status(400).json({ error: 'Can only close resolved tickets' }); return; }
    if (status === 'REOPENED' && ticket.status !== 'RESOLVED') { res.status(400).json({ error: 'Can only reopen resolved tickets' }); return; }
    if (ticket.creatorId !== user.id) { res.status(403).json({ error: 'Access denied' }); return; }
  } else if (user.role === 'AGENT') {
    if (!['IN_PROGRESS', 'WAITING', 'RESOLVED'].includes(status)) { res.status(403).json({ error: 'Invalid status for agent' }); return; }
    if (ticket.assigneeId !== user.id) { res.status(403).json({ error: 'Not your ticket' }); return; }
  }

  const updateData: Record<string, unknown> = { status };
  if (status === 'IN_PROGRESS' && !ticket.firstResponseAt) updateData['firstResponseAt'] = new Date();
  if (status === 'RESOLVED') {
    updateData['resolvedAt'] = new Date();
    ticketsResolvedTotal.inc();
    const durationSec = (Date.now() - ticket.createdAt.getTime()) / 1000;
    ticketResolutionDuration.observe(durationSec);
  }
  if (status === 'WAITING') updateData['waitingSince'] = new Date();
  if (status === 'IN_PROGRESS' && ticket.status === 'WAITING') updateData['waitingSince'] = null;
  if (status === 'REOPENED') {
    updateData['slaBreached'] = false;
    const { slaDeadlineResponse, slaDeadlineResolve } = calculateSlaDeadlines(ticket.priority, new Date());
    updateData['slaDeadlineResponse'] = slaDeadlineResponse;
    updateData['slaDeadlineResolve'] = slaDeadlineResolve;
  }

  const updated = await prisma.ticket.update({ where: { id: ticket.id }, data: updateData, select: TICKET_SELECT });

  const notifyUserId = user.role !== 'USER' ? ticket.creatorId : ticket.assigneeId;
  if (notifyUserId) {
    const notif = await prisma.notification.create({
      data: { userId: notifyUserId, ticketId: ticket.id, type: 'STATUS_CHANGED', title: 'Статус тикета изменился', message: `#${ticket.ticketNumber} → ${status}` },
    });
    emitNotification(notifyUserId, notif);
  }
  emitToTicket(ticket.id, 'ticket:status', updated);

  res.json(updated);
});

// PUT /api/tickets/:id/assign (admin)
ticketsRouter.put('/:id/assign', requireRole('ADMIN'), async (req, res: Response) => {
  const { assigneeId } = req.body as { assigneeId: string };
  const ticket = await prisma.ticket.update({
    where: { id: req.params['id'] },
    data: { assigneeId },
    select: TICKET_SELECT,
  });
  if (assigneeId) {
    const notif = await prisma.notification.create({
      data: { userId: assigneeId, ticketId: ticket.id, type: 'TICKET_ASSIGNED', title: 'Тикет переназначен вам', message: `#${ticket.ticketNumber}: ${ticket.subject}` },
    });
    emitNotification(assigneeId, notif);
  }
  res.json(ticket);
});

// POST /api/tickets/:id/rate
ticketsRouter.post('/:id/rate', async (req: AuthRequest, res: Response) => {
  const { score, comment } = req.body as { score: number; comment?: string };
  if (score < 1 || score > 5) { res.status(400).json({ error: 'Score must be 1-5' }); return; }

  const ticket = await prisma.ticket.findUnique({ where: { id: req.params['id'] } });
  if (!ticket) { res.status(404).json({ error: 'Not found' }); return; }
  if (ticket.creatorId !== req.user!.id) { res.status(403).json({ error: 'Only ticket creator can rate' }); return; }
  if (ticket.status !== 'CLOSED') { res.status(400).json({ error: 'Can only rate closed tickets' }); return; }

  const rating = await prisma.rating.upsert({
    where: { ticketId: ticket.id },
    update: { score, comment },
    create: { ticketId: ticket.id, userId: req.user!.id, score, comment },
  });

  if (ticket.assigneeId) {
    const notif = await prisma.notification.create({
      data: { userId: ticket.assigneeId, ticketId: ticket.id, type: 'TICKET_RATED', title: 'Пользователь оценил решение', message: `Оценка: ${score}/5 для тикета #${ticket.ticketNumber}` },
    });
    emitNotification(ticket.assigneeId, notif);
  }

  res.json(rating);
});