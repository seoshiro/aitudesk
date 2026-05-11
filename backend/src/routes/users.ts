import { Router, Response } from 'express';
import { z } from 'zod';
import path from 'path';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';

export const usersRouter = Router();
usersRouter.use(authenticate);

const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
});

// GET /api/users/me
usersRouter.get('/me', async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, name: true, email: true, role: true, avatarUrl: true, specializations: true, createdAt: true },
  });
  res.json(user);
});

// PUT /api/users/me
usersRouter.put('/me', async (req: AuthRequest, res: Response) => {
  try {
    const data = UpdateProfileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
      select: { id: true, name: true, email: true, role: true, avatarUrl: true },
    });
    res.json(user);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/me/avatar
usersRouter.post('/me/avatar', upload.single('avatar'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }
  const avatarUrl = `/uploads/${req.file.filename}`;
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { avatarUrl },
    select: { id: true, avatarUrl: true },
  });
  res.json(user);
});

// GET /api/users (admin only)
usersRouter.get('/', requireRole('ADMIN'), async (_req, res: Response) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, avatarUrl: true, specializations: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(users);
});

// GET /api/users/agents (for admin dropdown)
usersRouter.get('/agents', requireRole('ADMIN', 'AGENT'), async (_req, res: Response) => {
  const agents = await prisma.user.findMany({
    where: { role: { in: ['AGENT', 'ADMIN'] } },
    select: { id: true, name: true, email: true, role: true, specializations: true },
  });
  res.json(agents);
});

// PUT /api/users/:id/role (admin)
usersRouter.put('/:id/role', requireRole('ADMIN'), async (req, res: Response) => {
  const { role, specializations } = req.body as { role: string; specializations?: string[] };
  const user = await prisma.user.update({
    where: { id: req.params['id'] },
    data: { role: role as 'USER' | 'AGENT' | 'ADMIN', ...(specializations && { specializations: specializations as ('HARDWARE' | 'SOFTWARE' | 'NETWORK' | 'OTHER')[] }) },
    select: { id: true, name: true, email: true, role: true, specializations: true },
  });
  res.json(user);
});
