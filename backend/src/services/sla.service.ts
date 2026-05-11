import { Priority, TicketStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface SlaInfo {
  slaDeadlineResponse: Date;
  slaDeadlineResolve: Date;
  responseRemaining: number;   // seconds
  resolveRemaining: number;    // seconds
  isBreached: boolean;
  isPaused: boolean;
  colorCode: 'green' | 'yellow' | 'red';
}

const SLA_MAP: Record<Priority, { responseHours: number; resolutionHours: number }> = {
  CRITICAL: { responseHours: 2, resolutionHours: 4 },
  HIGH:     { responseHours: 4, resolutionHours: 8 },
  MEDIUM:   { responseHours: 8, resolutionHours: 24 },
  LOW:      { responseHours: 24, resolutionHours: 72 },
};

export function calculateSlaDeadlines(priority: Priority, createdAt: Date): { slaDeadlineResponse: Date; slaDeadlineResolve: Date } {
  const { responseHours, resolutionHours } = SLA_MAP[priority];
  return {
    slaDeadlineResponse: new Date(createdAt.getTime() + responseHours * 3600 * 1000),
    slaDeadlineResolve:  new Date(createdAt.getTime() + resolutionHours * 3600 * 1000),
  };
}




// Called by SLA background job to get breached tickets and notify
export async function checkSlaBreaches(): Promise<void> {
  const now = new Date();
  const openStatuses: TicketStatus[] = [TicketStatus.NEW, TicketStatus.IN_PROGRESS, TicketStatus.REOPENED];

  const breached = await prisma.ticket.findMany({
    where: { status: { in: openStatuses }, slaDeadlineResolve: { lt: now }, slaBreached: false },
    include: { assignee: { select: { id: true } }, creator: { select: { id: true } } },
  });

  for (const ticket of breached) {
    await prisma.ticket.update({ where: { id: ticket.id }, data: { slaBreached: true } });
    // create notifications for assign and admin
    if (ticket.assigneeId) {
      await prisma.notification.create({
        data: {
          userId: ticket.assigneeId,
          ticketId: ticket.id,
          type: 'SLA_BREACH',
          title: 'SLA нарушен!',
          message: `Тикет #${ticket.ticketNumber}: "${ticket.subject}" — SLA нарушен`,
        },
      });
    }
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          ticketId: ticket.id,
          type: 'SLA_BREACH',
          title: 'SLA нарушен у тикета',
          message: `Тикет #${ticket.ticketNumber}: "${ticket.subject}" просрочен`,
        },
      });
    }
  }
}
