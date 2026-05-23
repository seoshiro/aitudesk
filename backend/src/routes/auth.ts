import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? 'secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'refresh_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';

function signTokens(userId: string) {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
  const refreshToken = jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/register
authRouter.post('/register', validate(RegisterSchema), async (req, res: Response) => {
  const { name, email, password } = req.body as { name: string; email: string; password: string };
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) { res.status(409).json({ error: 'Email already in use' }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { name, email, passwordHash, role: 'USER' } });

  const { accessToken, refreshToken } = signTokens(user.id);
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } });

  res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'lax', expires: expiresAt });
  res.status(201).json({ accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl } });
});

// POST /api/auth/login
authRouter.post('/login', validate(LoginSchema), async (req, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) { res.status(401).json({ error: 'Invalid credentials' }); return; }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) { res.status(401).json({ error: 'Invalid credentials' }); return; }

  const { accessToken, refreshToken } = signTokens(user.id);
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id, expiresAt } });

  res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'lax', expires: expiresAt });
  res.json({ accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl } });
});

// POST /api/auth/refresh
authRouter.post('/refresh', async (req, res: Response) => {
  const token = (req.cookies as Record<string, string>)['refreshToken'];
  if (!token) { res.status(401).json({ error: 'No refresh token' }); return; }

  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string };
    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) { res.status(401).json({ error: 'Refresh token expired' }); return; }

    await prisma.refreshToken.delete({ where: { token } });
    const { accessToken, refreshToken: newRefresh } = signTokens(payload.userId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await prisma.refreshToken.create({ data: { token: newRefresh, userId: payload.userId, expiresAt } });

    res.cookie('refreshToken', newRefresh, { httpOnly: true, sameSite: 'lax', expires: expiresAt });
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, name: true, email: true, role: true, avatarUrl: true } });
    res.json({ accessToken, user });
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', async (req, res: Response) => {
  const token = (req.cookies as Record<string, string>)['refreshToken'];
  if (token) await prisma.refreshToken.deleteMany({ where: { token } });
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out' });
});
