/**
 * Database Exporter Pattern.
 *
 * Prom-client Gauge'ы с асинхронным `collect()` hook: каждый раз, когда
 * Prometheus делает скрейп `/metrics`, prom-client вызывает наш collect(),
 * который дёргает `prisma.ticket.count()` напрямую из PostgreSQL.
 *
 * Это даёт три ключевых свойства:
 *   1. Stateless / restart-safe: процесс может перезапускаться сколько угодно,
 *      значения никогда не «обнуляются».
 *   2. Multi-instance safe: при docker compose up --scale backend=N все
 *      инстансы вернут одно и то же значение из общей БД.
 *   3. Single Source of Truth: ручные изменения в pgAdmin/SQL подхватываются
 *      на следующем скрейпе (через ≤ scrape_interval).
 *
 * Стоимость: один лёгкий `SELECT COUNT(*)` (или groupBy) раз в 15 секунд —
 * для PostgreSQL это пыль.
 */
import client from 'prom-client';
import { TicketStatus } from '@prisma/client';
import { prisma } from './prisma';

// ─── Total tickets in DB ──────────────────────────────────────────────────
export const ticketsInDb = new client.Gauge({
  name: 'tickets_in_db',
  help: 'Total tickets currently stored in the database (DB-derived, source of truth)',
  async collect() {
    try {
      const count = await prisma.ticket.count();
      this.set(count);
    } catch (e) {
      // не падаем — просто пропускаем этот скрейп
      console.error('[dbMetrics] tickets_in_db collect failed:', e instanceof Error ? e.message : e);
    }
  },
});

// ─── Tickets grouped by status (labelled gauge) ───────────────────────────
export const ticketsByStatusInDb = new client.Gauge({
  name: 'tickets_by_status_in_db',
  help: 'Tickets grouped by current status (DB-derived)',
  labelNames: ['status'] as const,
  async collect() {
    try {
      const rows = await prisma.ticket.groupBy({
        by: ['status'],
        _count: { _all: true },
      });
      // Сбрасываем все лейблы, чтобы не «висели» удалённые статусы
      this.reset();
      const seen = new Set<TicketStatus>();
      for (const r of rows) {
        this.set({ status: r.status }, r._count._all);
        seen.add(r.status);
      }
      // Гарантируем, что все статусы присутствуют в выдаче (для красивых графиков)
      for (const s of Object.values(TicketStatus)) {
        if (!seen.has(s)) this.set({ status: s }, 0);
      }
    } catch (e) {
      console.error('[dbMetrics] tickets_by_status_in_db collect failed:', e instanceof Error ? e.message : e);
    }
  },
});

// ─── Tickets in resolved/closed state ─────────────────────────────────────
export const ticketsResolvedInDb = new client.Gauge({
  name: 'tickets_resolved_in_db',
  help: 'Tickets currently in RESOLVED or CLOSED state (DB-derived)',
  async collect() {
    try {
      const count = await prisma.ticket.count({
        where: { status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] } },
      });
      this.set(count);
    } catch (e) {
      console.error('[dbMetrics] tickets_resolved_in_db collect failed:', e instanceof Error ? e.message : e);
    }
  },
});

// ─── Open tickets (NEW + IN_PROGRESS + WAITING + REOPENED) ────────────────
export const ticketsOpenInDb = new client.Gauge({
  name: 'tickets_open_in_db',
  help: 'Tickets currently open / in progress (DB-derived)',
  async collect() {
    try {
      const count = await prisma.ticket.count({
        where: {
          status: {
            in: [
              TicketStatus.NEW,
              TicketStatus.IN_PROGRESS,
              TicketStatus.WAITING,
              TicketStatus.REOPENED,
            ],
          },
        },
      });
      this.set(count);
    } catch (e) {
      console.error('[dbMetrics] tickets_open_in_db collect failed:', e instanceof Error ? e.message : e);
    }
  },
});

// ─── SLA-breached tickets ─────────────────────────────────────────────────
export const ticketsSlaBreachedInDb = new client.Gauge({
  name: 'tickets_sla_breached_in_db',
  help: 'Tickets currently flagged as SLA-breached (DB-derived)',
  async collect() {
    try {
      const count = await prisma.ticket.count({ where: { slaBreached: true } });
      this.set(count);
    } catch (e) {
      console.error('[dbMetrics] tickets_sla_breached_in_db collect failed:', e instanceof Error ? e.message : e);
    }
  },
});

// ─── Avg resolution time across resolved tickets (DB-derived) ─────────────
export const ticketsAvgResolutionSeconds = new client.Gauge({
  name: 'tickets_avg_resolution_seconds_in_db',
  help: 'Average resolution time across resolved tickets in seconds (DB-derived)',
  async collect() {
    try {
      // Pull only timestamps — дёшево даже на десятках тысяч записей
      const rows = await prisma.ticket.findMany({
        where: { resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      });
      if (rows.length === 0) {
        this.set(0);
        return;
      }
      const totalSec = rows.reduce(
        (acc, t) => acc + (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 1000,
        0,
      );
      this.set(totalSec / rows.length);
    } catch (e) {
      console.error(
        '[dbMetrics] tickets_avg_resolution_seconds_in_db collect failed:',
        e instanceof Error ? e.message : e,
      );
    }
  },
});

// ─── Users / KB articles — бонусные SoT-метрики ───────────────────────────
export const usersInDb = new client.Gauge({
  name: 'users_in_db',
  help: 'Total users in the database (DB-derived)',
  async collect() {
    try {
      this.set(await prisma.user.count());
    } catch (e) {
      console.error('[dbMetrics] users_in_db collect failed:', e instanceof Error ? e.message : e);
    }
  },
});

export const kbArticlesInDb = new client.Gauge({
  name: 'kb_articles_in_db',
  help: 'Total published knowledge base articles (DB-derived)',
  async collect() {
    try {
      this.set(await prisma.knowledgeArticle.count({ where: { published: true } }));
    } catch (e) {
      console.error('[dbMetrics] kb_articles_in_db collect failed:', e instanceof Error ? e.message : e);
    }
  },
});
