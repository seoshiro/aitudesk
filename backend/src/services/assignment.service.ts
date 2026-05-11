import { TicketCategory } from '@prisma/client';
import { prisma } from '../lib/prisma';

export async function autoAssignTicket(category: TicketCategory): Promise<string | null> {
  // Find all agents that handle this category
  const agents = await prisma.user.findMany({
    where: { role: 'AGENT', specializations: { has: category } },
    select: { id: true },
  });

  if (agents.length === 0) {
    // Fallback: any agent
    const anyAgent = await prisma.user.findFirst({
      where: { role: 'AGENT' },
      select: { id: true },
    });
    return anyAgent?.id ?? null;
  }

  // Find the one with the fewest active tickets
  const counts = await Promise.all(
    agents.map(async (agent) => {
      const count = await prisma.ticket.count({
        where: {
          assigneeId: agent.id,
          status: { in: ['NEW', 'IN_PROGRESS', 'WAITING', 'REOPENED'] },
        },
      });
      return { agentId: agent.id, count };
    })
  );

  counts.sort((a, b) => a.count - b.count);
  return counts[0]?.agentId ?? null;
}
