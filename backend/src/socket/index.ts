import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { getAccessTokenSecret, isOriginAllowed } from '../lib/env';

interface SocketUser {
  userId: string;
  role: string;
  name: string;
}

let io: Server;

export function getIo(): Server { return io; }

export function initSocket(httpServer: HttpServer): void {
  io = new Server(httpServer, {
    cors: {
      origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
        if (isOriginAllowed(origin)) return cb(null, true);
        cb(new Error(`Socket.IO CORS blocked: ${origin}`));
      },
      credentials: true,
    },
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth['token'] as string | undefined;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = jwt.verify(token, getAccessTokenSecret()) as { userId: string };
      (socket.data as SocketUser & { userId: string }).userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId } = socket.data as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, name: true } });
    if (!user) { socket.disconnect(); return; }

    socket.data = { ...socket.data, ...user };

    // Join personal notification room
    void socket.join(`user:${userId}`);
    console.log(`🔌 Socket connected: ${user.name} (${user.role})`);

    // Join ticket room
    socket.on('ticket:join', (ticketId: string) => {
      void socket.join(`ticket:${ticketId}`);
    });

    socket.on('ticket:leave', (ticketId: string) => {
      void socket.leave(`ticket:${ticketId}`);
    });

    // Typing indicator
    socket.on('typing:start', ({ ticketId }: { ticketId: string }) => {
      socket.to(`ticket:${ticketId}`).emit('typing:start', { userId, userName: user.name });
    });

    socket.on('typing:stop', ({ ticketId }: { ticketId: string }) => {
      socket.to(`ticket:${ticketId}`).emit('typing:stop', { userId });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${user.name}`);
    });
  });
}

// Emit notification to a specific user
export function emitNotification(userId: string, notification: object): void {
  if (io) io.to(`user:${userId}`).emit('notification:new', notification);
}

// Emit to ticket room
export function emitToTicket(ticketId: string, event: string, data: object): void {
  if (io) io.to(`ticket:${ticketId}`).emit(event, data);
}
