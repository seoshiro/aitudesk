import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index';
import { prismaMock } from './setup';
import { TEST_USER, userToken, authHeader } from './helpers';

describe('GET /api/notifications', () => {
  it('returns user notifications', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.notification.findMany.mockResolvedValue([
      { id: 'n1', type: 'TICKET_ASSIGNED', title: 'Assigned', message: 'Ticket #1', read: false, createdAt: new Date() },
    ]);
    prismaMock.notification.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/notifications')
      .set(authHeader(userToken));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('notifications');
    expect(res.body).toHaveProperty('unreadCount', 1);
    expect(res.body.notifications).toHaveLength(1);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/notifications/read-all', () => {
  it('marks all as read', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.notification.updateMany.mockResolvedValue({ count: 3 });

    const res = await request(app)
      .put('/api/notifications/read-all')
      .set(authHeader(userToken));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('All marked as read');
  });
});

describe('PUT /api/notifications/:id/read', () => {
  it('marks single notification as read', async () => {
    prismaMock.user.findUnique.mockResolvedValue(TEST_USER);
    prismaMock.notification.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .put('/api/notifications/n1/read')
      .set(authHeader(userToken));

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Marked as read');
  });
});
