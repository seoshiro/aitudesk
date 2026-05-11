import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useNotifStore } from '../store/notifStore';

// Priority: explicit env → auto-detect → same-origin (Nginx proxy path)
const SOCKET_URL_ENV = (import.meta.env['VITE_SOCKET_URL'] as string | undefined) ?? '';

// Browser Preview / devtools open the app through a proxy on a random port
// (e.g. http://127.0.0.1:62135) that does NOT forward WebSocket Upgrade frames.
// In that case we bypass Nginx and connect straight to the backend on :4829.
// Standard ports (7754 = docker nginx, 80/443 = prod) keep same-origin behaviour.
function resolveSocketUrl(): string {
  if (SOCKET_URL_ENV) return SOCKET_URL_ENV;
  if (typeof window === 'undefined') return '';
  const { protocol, hostname, port, origin } = window.location;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  const isStandardPort = port === '' || port === '80' || port === '443' || port === '7754';
  if (isLocal && !isStandardPort) {
    return `${protocol}//${hostname}:4829`;
  }
  return origin;
}

let socket: Socket | null = null;

export function getSocket(): Socket | null { return socket; }

export function connectSocket(): void {
  const token = useAuthStore.getState().accessToken;
  if (!token || socket?.connected) return;

  socket = io(resolveSocketUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
    path: '/socket.io',
    withCredentials: true,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => console.log('🔌 Socket connected'));
  socket.on('disconnect', () => console.log('🔌 Socket disconnected'));
  socket.on('connect_error', (err) => console.warn('🔌 Socket error:', err.message));

  socket.on('notification:new', (notif) => {
    useNotifStore.getState().addNotification(notif);
  });
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function joinTicketRoom(ticketId: string): void {
  socket?.emit('ticket:join', ticketId);
}

export function leaveTicketRoom(ticketId: string): void {
  socket?.emit('ticket:leave', ticketId);
}

export function sendTypingStart(ticketId: string): void {
  socket?.emit('typing:start', { ticketId });
}

export function sendTypingStop(ticketId: string): void {
  socket?.emit('typing:stop', { ticketId });
}
