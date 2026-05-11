import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prismaMock } from './setup';
import {
  TEST_USER, TEST_AGENT, TEST_ADMIN,
  userToken, agentToken, adminToken,
  authHeader,
} from './helpers';

describe('GET /api/dashboard/stats', () => {
  it('returns user stats for USER role', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.ticket.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(3)  // active
      .mockResolvedValueOnce(5)  // resolved
      .mockResolvedValueOnce(2); // closed

    const res = await request(app)
      .get('/api/dashboard/stats')
      .set(authHeader(userToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total', 10);
    expect(res.body).toHaveProperty('active', 3);
    expect(res.body).toHaveProperty('resolved', 5);
    expect(res.body).toHaveProperty('closed', 2);
  });

  it('returns agent stats for AGENT role', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_AGENT);
    prismaMock.ticket.count
      .mockResolvedValueOnce(15)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(1);
    prismaMock.rating.aggregate.mockResolvedValue({ _avg: { score: 4.5 } });

    const res = await request(app)
      .get('/api/dashboard/stats')
      .set(authHeader(agentToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total', 15);
    expect(res.body).toHaveProperty('avgRating', 4.5);
  });

  it('returns admin stats for ADMIN role', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);
    prismaMock.ticket.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(60)
      .mockResolvedValueOnce(15);
    prismaMock.$queryRaw.mockResolvedValue([{ avg_hours: 12.5 }]);
    prismaMock.rating.aggregate.mockResolvedValue({ _avg: { score: 4.2 } });

    const res = await request(app)
      .get('/api/dashboard/stats')
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total', 100);
    expect(res.body).toHaveProperty('avgResolutionHours', 12.5);
    expect(res.body).toHaveProperty('avgRating', 4.2);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/dashboard/tickets-by-day', () => {
  it('admin can access', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);
    prismaMock.$queryRaw.mockResolvedValue([
      { date: '2024-01-15', count: 5 },
      { date: '2024-01-16', count: 8 },
    ]);

    const res = await request(app)
      .get('/api/dashboard/tickets-by-day')
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('user gets 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);

    const res = await request(app)
      .get('/api/dashboard/tickets-by-day')
      .set(authHeader(userToken));

    expect(res.status).toBe(403);
  });
});

describe('GET /api/dashboard/by-category', () => {
  it('admin gets category breakdown', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);
    prismaMock.ticket.groupBy.mockResolvedValue([
      { category: 'SOFTWARE', _count: { _all: 10 } },
      { category: 'HARDWARE', _count: { _all: 5 } },
    ]);

    const res = await request(app)
      .get('/api/dashboard/by-category')
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('category');
    expect(res.body[0]).toHaveProperty('count');
  });

  it('user gets 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);

    const res = await request(app)
      .get('/api/dashboard/by-category')
      .set(authHeader(userToken));

    expect(res.status).toBe(403);
  });
});

describe('GET /api/dashboard/agents', () => {
  it('admin can see agent leaderboard', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: TEST_AGENT.id,
        name: TEST_AGENT.name,
        avatarUrl: null,
        assignedTickets: [
          { status: 'RESOLVED', resolvedAt: new Date(), createdAt: new Date(Date.now() - 3600000), rating: { score: 5 } },
          { status: 'IN_PROGRESS', resolvedAt: null, createdAt: new Date(), rating: null },
        ],
      },
    ]);

    const res = await request(app)
      .get('/api/dashboard/agents')
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('resolved');
    expect(res.body[0]).toHaveProperty('avgRating');
  });

  it('agent gets 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_AGENT);

    const res = await request(app)
      .get('/api/dashboard/agents')
      .set(authHeader(agentToken));

    expect(res.status).toBe(403);
  });
});
