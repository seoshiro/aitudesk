import { Router, Response } from 'express';
import { z, ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';

export const usersRouter = Router();
usersRouter.use(authenticate);

const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
});

const UpdateRoleSchema = z.object({
  role: z.enum(['USER', 'AGENT', 'ADMIN']),
  specializations: z.array(z.enum(['HARDWARE', 'SOFTWARE', 'NETWORK', 'OTHER'])).optional(),
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
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'Email already in use' });
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
  try {
    const { role, specializations } = UpdateRoleSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.params['id'] },
      data: { role, ...(specializations && { specializations }) },
      select: { id: true, name: true, email: true, role: true, specializations: true },
    });
    res.json(user);
  } catch (err: unknown) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});
