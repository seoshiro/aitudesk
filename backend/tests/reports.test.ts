import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prismaMock } from './setup';
import { TEST_ADMIN, TEST_USER, adminToken, userToken, authHeader } from './helpers';

describe('GET /api/reports/monthly', () => {
  it('returns PDF for valid month', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);
    prismaMock.ticket.count
      .mockResolvedValueOnce(25)  // closedCount
      .mockResolvedValueOnce(40); // createdCount
    prismaMock.$queryRaw.mockResolvedValue([{ avg_hours: 6.5 }]);
    prismaMock.rating.aggregate.mockResolvedValue({ _avg: { score: 4.3 }, _count: { score: 15 } });

    const res = await request(app)
      .get('/api/reports/monthly?month=2024-01')
      .set(authHeader(adminToken));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('report-2024-01.pdf');
    expect(res.body).toBeInstanceOf(Buffer);
    // PDF magic bytes %PDF
    expect(res.body.slice(0, 4).toString()).toBe('%PDF');
  });

  it('returns 400 for missing month param', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);

    const res = await request(app)
      .get('/api/reports/monthly')
      .set(authHeader(adminToken));

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('month');
  });

  it('returns 400 for invalid month format', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);

    const res = await request(app)
      .get('/api/reports/monthly?month=January2024')
      .set(authHeader(adminToken));

    expect(res.status).toBe(400);
  });

  it('returns 400 for month > 12', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_ADMIN);

    const res = await request(app)
      .get('/api/reports/monthly?month=2024-13')
      .set(authHeader(adminToken));

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .get('/api/reports/monthly?month=2024-01');

    expect(res.status).toBe(401);
  });

  it('user can also download report', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.ticket.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(10);
    prismaMock.$queryRaw.mockResolvedValue([{ avg_hours: null }]);
    prismaMock.rating.aggregate.mockResolvedValue({ _avg: { score: null }, _count: { score: 0 } });

    const res = await request(app)
      .get('/api/reports/monthly?month=2024-06')
      .set(authHeader(userToken));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
  });
});
