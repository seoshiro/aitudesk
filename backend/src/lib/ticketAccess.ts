import type { Role, TicketStatus } from '@prisma/client';

type TicketAccessUser = {
  id: string;
  role: Role;
};

type TicketAccessRecord = {
  creatorId: string;
  assigneeId?: string | null;
  status: TicketStatus;
};

export function canAccessTicket(user: TicketAccessUser | undefined, ticket: TicketAccessRecord): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.role === 'USER') return ticket.creatorId === user.id;
  return ticket.assigneeId === user.id || (ticket.assigneeId === null && ticket.status === 'NEW');
}
